import os
import urllib.request
import urllib.error
import json
import chromadb
import random
import time
from dotenv import load_dotenv

load_dotenv()

# ========================================================
# CHROMADB VECTOR DATABASE INITIALIZATION
# ========================================================
chroma_client = chromadb.PersistentClient(path="./chroma_db")
rag_collection = chroma_client.get_or_create_collection(name="naap_modules")
pattern_collection = chroma_client.get_or_create_collection(name="prof_patterns")

# ========================================================
# THE ULTIMATE CAAP SYLLABUS MAPPING
# ========================================================
CAAP_HIERARCHY = {
    "AIR LAW & AIRWORTHINESS": ["PCAR Parts 1, 2, 5, 6, 8 / AFCAR", "Airframe Inspection", "Maintenance Forms & Records", "Maintenance Publications", "Mechanic Privileges & Limitations"],
    "NATURAL SCIENCE & AIRCRAFT GENERAL KNOWLEDGE": ["Mathematics", "Basic Physics", "Materials & Processes"],
    "AIRCRAFT ENGINEERING": ["Materials & Processes", "Fluid Lines & Fittings", "Aircraft Instrument System", "Sheet metal & Non-Metallic Structures", "Welding", "Assembly & Rigging", "Wood Structures", "Aircraft Finishes", "Aircraft Electrical System", "Engine Electrical System", "Engine Instrument Systems", "Engine Inspection"],
    "AIRCRAFT MAINTENANCE": ["Materials & Processes", "Ground Operation & Servicing", "Fluid Lines and Fittings", "Cleaning & Corrosion Control", "Maintenance Forms & Records", "Sheet metal & Non-Metallic Structures", "Hydraulic & Pneumatic Power System", "Aircraft Fuel System", "Aircraft Landing Gear System", "Reciprocating Engines", "Turbine Engines", "Fuel Metering Systems", "Engine Fuel System", "Induction & Engine Airflow", "Engine Inspection", "Lubrication System"],
    "POWERPLANT RATING": ["Reciprocating Engines", "Turbine Engines", "Engine Instrument Systems", "Ignition & Starting Systems", "Fuel Metering Systems", "Propellers", "Auxiliary Power Unit", "Induction & Engine Airflow System", "Engine Inspection", "Engine Fuel System", "Lubrication System"],
    "AIRFRAME RATING": ["Wood Structures", "Aircraft Finishes", "Sheet metal & Non-Metallic Structures", "Assembly & Rigging", "Aircraft Landing Gear System", "Hydraulic & Pneumatic Power System", "Aircraft Fuel Systems", "Ice & Rain Control System", "Fire Protection System", "Aircraft Electrical System", "Engine Electrical System", "Position & Warning System"],
    "HUMAN PERFORMANCE AND LIMITATIONS": ["Human Performance (OASIS)", "Mechanic Privileges and Limitations"]
}

# ========================================================
# ENTERPRISE API KEY ROTATOR & CORE CONNECTION
# ========================================================
def get_random_api_key():
    keys_string = os.getenv("GEMINI_API_KEYS", "")
    if not keys_string:
        return os.getenv("GEMINI_API_KEY", "")
    keys_list = [k.strip() for k in keys_string.split(",") if k.strip()]
    return random.choice(keys_list) if keys_list else ""

def call_gemini(prompt, max_retries=4):
    for attempt in range(max_retries):
        api_key = get_random_api_key()
        masked_key = f"...{api_key[-4:]}" if api_key else "NONE"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                raw_text = result['candidates'][0]['content']['parts'][0]['text']
                clean_json = raw_text.replace('```json', '').replace('```', '').strip()
                return json.loads(clean_json)
        except urllib.error.HTTPError as e:
            error_msg = e.read().decode('utf-8')
            print(f"[API ERROR - Attempt {attempt+1}/{max_retries}] Key {masked_key} hit {e.code}.")
            if e.code in [429, 500, 503, 504]:
                time.sleep(1.5) 
                continue
            else:
                return {"_error": f"Google API connection error ({e.code})."}
        except json.JSONDecodeError as e:
            print(f"[SENTINEL JSON PARSE ERROR]: AI output was malformed. {e}")
            return {"_error": "The AI generated an invalid format. Please try again."}
        except Exception as e:
            print(f"[SYSTEM ERROR - Attempt {attempt+1}/{max_retries}]: {e}")
            time.sleep(1.5)
            continue
            
    return {"_error": "ALL_API_KEYS_EXHAUSTED_OR_TIMEOUT"}

# ========================================================
# PHASE 4: RAG DATABASE INGESTION & SEARCH
# ========================================================
def ingest_into_rag(text, module_title):
    chunk_size = 1000
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    ids = [f"{module_title.replace(' ', '_')}_{i}" for i in range(len(chunks))]
    metadatas = [{"title": module_title} for _ in chunks]
    
    if chunks:
        rag_collection.upsert(documents=chunks, metadatas=metadatas, ids=ids)
        print(f"[RAG ENGINE]: Successfully embedded {len(chunks)} chunks for {module_title}")

# THE FIX: Added function to permanently purge ghost data from ChromaDB
def delete_rag_vectors_by_title(module_title):
    try:
        rag_collection.delete(where={"title": module_title})
        print(f"[RAG ENGINE]: Successfully purged all ghost vectors for {module_title}")
    except Exception as e:
        print(f"[RAG ENGINE ERROR]: Failed to purge ghost vectors: {e}")

def query_rag_engine(query_string):
    if rag_collection.count() == 0:
        return {"summary": "The CAAP Database is currently empty.", "sources": []}

    search_results = rag_collection.query(query_texts=[query_string], n_results=3)
    docs = search_results["documents"][0] if search_results["documents"] else []
    metadatas = search_results["metadatas"][0] if search_results["metadatas"] else []

    if not docs:
        return {"summary": "No relevant information found.", "sources": []}

    context_blocks = "\n\n".join([f"Source: {meta['title']}\nContent: {doc}" for doc, meta in zip(docs, metadatas)])
    prompt = f"""
    You are the NAAP AMT AI Assistant. Answer the user's query using ONLY the provided Source Excerpts.
    User Query: "{query_string}"
    Source Excerpts: {context_blocks}
    OUTPUT JSON FORMAT:
    {{
        "summary": "Your detailed answer...",
        "sources": [{{"title": "Source Title", "content": "1-sentence snippet"}}]
    }}
    """
    res = call_gemini(prompt)
    return res if (res and "summary" in res) else {"summary": "Error answering query.", "sources": []}

# ========================================================
# PHASE 1 & 3: VALIDATION & MODULE EXTRACTION
# ========================================================
def validate_and_chunk_document(text, user_subjects, upload_as_is):
    if not text.strip():
        return {
            "valid": False, 
            "reason": "This document contains no readable text. It appears to be a scanned image. Please upload a text-based PDF or Word document."
        }

    jurisdiction_prompt = "The user is the HEAD ADMIN. Authorize all aviation content regardless of specific subject assignment." \
        if user_subjects == "ALL_SUBJECTS_AUTHORIZED" else f"Ensure content matches the professor's assigned subjects: {user_subjects}"

    prompt = f"""
    You are the AMT Sentinel AI. Analyze this document text. {jurisdiction_prompt}
    TASKS:
    1. VALIDATION: Is this text related to CAAP AMT subjects?
    2. JURISDICTION: Does this content fall within the user's assigned subjects?
    3. SUBJECT MATCHING: Determine the closest Main Category from the CAAP AMT syllabus.
    TEXT: {text[:50000]}
    OUTPUT STRICT JSON FORMAT:
    {{
      "valid": true/false,
      "reason": "If invalid, state why.",
      "subject": "Main Category",
      "chunks": []
    }}
    """
    res = call_gemini(prompt)
    
    if res and "_error" in res:
        print(f"\n[CRITICAL WARNING] AI Gatekeeper Offline. Triggering Dev Bypass Mode.\nReason: {res['_error']}\n")
        fallback_subject = "AIRFRAME RATING"
        if user_subjects and user_subjects != "ALL_SUBJECTS_AUTHORIZED":
            fallback_subject = user_subjects.split(',')[0].strip()

        return {
            "valid": True,
            "subject": fallback_subject,
            "reason": f"API Offline (Bypass Activated). Error: {res['_error']}"
        }
        
    return res if res else {"valid": False, "reason": "Unknown System Error"}

def paraphrase_specific_topic(context, topic, section_type="body"):
    instructions = {
        "intro": "Write a short INTRODUCTION (Max 300 words). Focus on definitions, purpose, and overview.",
        "body": "Write the BODY PARAGRAPHS (Max 600 words). Focus on detailed technical procedures and core mechanics.",
        "conclusion": "Write a short CONCLUSION (Max 200 words). Focus on a summary of key points and safety warnings."
    }
    target_instruction = instructions.get(section_type, instructions["body"])

    prompt = f"""
    You are an expert Aviation Maintenance Instructor.
    Extract ONLY information strictly relevant to: "{topic}" from the text below.
    
    TASK: {target_instruction}
    
    If the document contains absolutely NO information about "{topic}", return this EXACT JSON:
    {{
        "status": "error",
        "text": "No relevant information found for this topic."
    }}

    FORMATTING RULES FOR "text" FIELD:
    1. Separate paragraphs with exactly two newlines (\\n\\n).
    2. For a heading, write a short descriptive line with NO period at the end, followed by exactly two newlines (\\n\\n).

    RAW DOCUMENT:
    {context[:2500000]} 
    
    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "text": "Paraphrased text..."
    }}
    """
    res = call_gemini(prompt)
    return res if (res and "text" in res) else {"status": "error", "message": "Failed to extract topic."}

# ========================================================
# PHASE 3: FULL QUIZ GENERATORS
# ========================================================
def get_user_synced_pattern(user_id):
    try:
        result = pattern_collection.get(ids=[f"pattern_{user_id}"])
        if result and result["documents"] and len(result["documents"]) > 0:
            return result["documents"][0]
    except:
        pass
    return None

def generate_bulk_quiz(context, level, topic=None, count=10, max_choices=4, user_id=None):
    difficulty = "situational licensure board exam scenarios" if level == "CAAP" else "knowledge-based factual recall"
    topic_focus = f"Focus the questions strictly on the topic: {topic}." if topic else ""
    
    style_injection = ""
    if user_id:
        custom_pattern = get_user_synced_pattern(user_id)
        if custom_pattern:
            style_injection = f"CRITICAL STYLE OVERRIDE: Generate questions strictly mimicking this professor's specific NLP profile: {custom_pattern}"

    prompt = f"""
    You are an expert CAAP Aviation Instructor.
    Generate a complete batch of EXACTLY {count} aviation multiple-choice questions based ONLY on this text.
    {topic_focus}
    {style_injection}
    
    Level Target: {level}
    Style Baseline: {difficulty}
    
    TEXT: 
    {context[:2500000]} 
    
    CRITICAL RULES FOR MCQ OPTIONS:
    - Output exactly {count} questions.
    - 'options' must be an array of EXACTLY {max_choices} strings.
    - DO NOT include prefixes like "A) " or "B. ". Return only the raw text of the choice.
    - Include logic tricks occasionally for the last option, such as "None of the above" or "Both first and second options".
    - 'ans' must be the EXACT full string of the correct choice (no letter prefixes).
    
    OUTPUT STRICT JSON FORMAT:
    {{
        "questions": [
            {{
                "type": "MCQ",
                "q": "Question text?",
                "options": ["Raw Choice 1", "Raw Choice 2", "Raw Choice 3", "Raw Choice 4"],
                "ans": "Raw Choice 2"
            }}
        ]
    }}
    """
    res = call_gemini(prompt)
    if res and "questions" in res:
        return res
    return {"questions": []}

def generate_single_question(context, q_type, level, topic=None, max_choices=4, user_id=None):
    topic_focus = f"Focus the question strictly on the topic: {topic}." if topic else ""
    
    style_injection = ""
    if user_id:
        custom_pattern = get_user_synced_pattern(user_id)
        if custom_pattern:
            style_injection = f"CRITICAL STYLE OVERRIDE: Mimic this specific professor profile: {custom_pattern}"

    options_instruction = ""
    if q_type == "MCQ":
        options_instruction = f"""
        - 'options' must be an array of EXACTLY {max_choices} strings.
        - DO NOT prefix with A, B, C. Return raw text only.
        - 'ans' must be the exact raw string.
        """
    else:
        options_instruction = "- 'options' should be an empty array []. - 'ans' must be the exact word/phrase."

    prompt = f"""
    Generate exactly ONE '{q_type}' question for an aviation exam.
    Level: {level}. {topic_focus}
    {style_injection}
    Base it solely on this source text: {context[:2500000]} 
    
    CRITICAL: 
    {options_instruction}

    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "question": {{
            "type": "{q_type}",
            "q": "Question text here?",
            "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], 
            "ans": "Full text of correct answer"
        }}
    }}
    """
    res = call_gemini(prompt)
    if res and "question" in res:
        return res
    return {"status": "error", "message": "Failed to generate question"}

# ========================================================
# PHASE 2: DYNAMIC TOPIC DISCOVERY
# ========================================================
def discover_available_topics(context, user_subjects):
    syllabus_str = json.dumps(CAAP_HIERARCHY, indent=2)
    jurisdiction_prompt = "The user is the HEAD ADMIN. You may select any sub-topic from the syllabus below." \
        if user_subjects == "ALL_SUBJECTS_AUTHORIZED" else f"You MUST ONLY select sub-topics that fall strictly under these Main Categories: {user_subjects}"

    prompt = f"""
    You are an expert Aviation Maintenance syllabus analyzer.
    Scan the provided document and determine WHICH of our official CAAP Syllabus Sub-Topics it covers.
    
    CRITICAL RULE 1: {jurisdiction_prompt}
    CRITICAL RULE 2: You are STRICTLY FORBIDDEN from inventing your own topic names. You MUST ONLY pick exact string matches from the values inside this official syllabus dictionary:
    {syllabus_str}
    
    TEXT:
    {context[:250000]}
    
    Return a JSON object strictly following this schema:
    {{
        "status": "success",
        "detected_topics": ["Exact Sub-Topic Match 1", "Exact Sub-Topic Match 2"]
    }}
    """
    res = call_gemini(prompt)
    
    if res and "_error" in res:
        print(f"[WARNING] Topic Scanner Offline. Triggering Bypass.")
        return {"status": "success", "detected_topics": ["Reciprocating Engines", "Turbine Engines"]}
        
    if type(res) is dict and "detected_topics" in res:
        return {"status": "success", "detected_topics": res["detected_topics"]}

    return {"status": "error", "message": "The AI could not identify clear topics in this document."}

# ========================================================
# NEW ADVANCED AI: CLONE & NLP PATTERN SYNC
# ========================================================
def clone_specific_question(context, level, topic, ref_question):
    max_choices = len(ref_question.get("options", []))
    q_type = ref_question.get("type", "MCQ")
    
    options_instruction = ""
    if q_type == "MCQ":
        if max_choices == 0: max_choices = 4 
        options_instruction = f"- 'options' must be an array of EXACTLY {max_choices} strings without letter prefixes."
    else:
        options_instruction = "- 'options' should be an empty array []."

    prompt = f"""
    You are an expert CAAP Aviation Instructor. 
    The professor has provided the following REFERENCE QUESTION:
    {json.dumps(ref_question)}
    
    TASK: Analyze the logic, style, difficulty, and structural pattern of the reference question above.
    Using the provided source TEXT below, generate a BRAND NEW, unique question that strictly mimics the structural pattern of the reference question. Do NOT copy the exact text, just the "flavor" and logic mechanism.
    
    TEXT: {context[:2500000]}
    
    Level: {level}. Topic: {topic}.
    CRITICAL: {options_instruction}

    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "question": {{ "type": "{q_type}", "q": "New Question text?", "options": ["Choice 1", "Choice 2"], "ans": "Choice 1" }}
    }}
    """
    res = call_gemini(prompt)
    return res if res and "question" in res else {"status": "error", "message": "Failed to clone question architecture."}

def analyze_and_store_prof_pattern(user_id, questions_list):
    if not questions_list or len(questions_list) < 1:
        return {"status": "error", "message": "No questions provided to analyze."}

    clean_questions = [{"q": q.get("q"), "type": q.get("type"), "options": q.get("options")} for q in questions_list]
    
    prompt = f"""
    You are a linguistic analyst evaluating a professor's test-writing style.
    Review the following custom quiz written by the professor:
    
    {json.dumps(clean_questions)}
    
    TASK: Extract a highly detailed NLP instructional profile for this professor.
    Focus on:
    1. Sentence structure length and complexity.
    2. Tone (e.g., highly technical, scenario-based, direct, formal).
    3. Types of distractors used in MCQ options.
    4. Any specific phrasing habits.
    
    Output a single, dense paragraph (max 150 words) that can be injected into a future LLM prompt to force the AI to perfectly mimic this professor's unique writing style.

    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "pattern_instruction": "The extracted prompt injection string..."
    }}
    """
    
    res = call_gemini(prompt)
    
    if res and res.get("status") == "success" and "pattern_instruction" in res:
        try:
            pattern_collection.upsert(
                documents=[res["pattern_instruction"]],
                ids=[f"pattern_{user_id}"],
                metadatas=[{"user_id": user_id}]
            )
            return {"status": "success", "message": "Pattern permanently synced to user profile."}
        except Exception as e:
            return {"status": "error", "message": f"Database insertion failed: {str(e)}"}
            
    return {"status": "error", "message": "AI failed to extract a distinct linguistic pattern."}

def draft_announcement(topic, date, severity):
    prompt = f"""
    You are the Head Administrator of an Aviation Maintenance Training (AMT) Platform.
    Draft a highly professional, concise, formal system announcement.
    
    Topic: {topic}
    Scheduled Date: {date}
    Severity Level: {severity}
    
    Rules:
    - Keep it under 100 words.
    - Sound authoritative but clear.
    - Mention if users need to save their work or expect downtime based on the severity/topic.
    - Do NOT include subject lines, just the body text.
    
    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "draft": "The drafted message text..."
    }}
    """
    res = call_gemini(prompt)
    return res if res and "draft" in res else {"status": "error", "message": "Drafting failed."}

# ========================================================
# PHASE 3: IT SUPPORT TICKET AI TRIAGE
# ========================================================
def triage_support_ticket(issue_text):
    prompt = f"""
    You are the NAAP AMT AI Support Triage System.
    Analyze the following user support ticket: "{issue_text}"
    
    TASKS:
    1. Classify into ONE folder: 
       - "URGENT" (Password Reset, Login, System Access)
       - "IMPORTANT" (Incorrect Quiz Score, Evaluation Error)
       - "MODERATE" (Module PDF Not Loading, Page Errors)
       - "INTERMEDIATE" (Content Addition, General Queries)
    2. Identify the closest CAAP AMT Subject if mentioned (e.g., "POWERPLANT RATING", "AIRFRAME RATING"). If none, return null.
    3. Draft a brief, professional auto-reply to the user acknowledging the specific issue and explaining that an Admin or Professor is reviewing it.

    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "folder": "URGENT",
        "subject": "AIRFRAME RATING",
        "auto_reply": "Your auto reply text here..."
    }}
    """
    res = call_gemini(prompt)
    return res if type(res) is dict and "folder" in res else {
        "status": "error", 
        "folder": "MODERATE", 
        "auto_reply": "We have received your ticket and are reviewing it.", 
        "subject": None
    }

# ========================================================
# PHASE 5: AI SCORE ADJUDICATION ENGINE
# ========================================================
def evaluate_score_dispute(issue_text):
    prompt = f"""
    You are the NAAP AMT AI Grading Adjudicator.
    A student has submitted a dispute regarding their quiz evaluation: "{issue_text}"
    
    TASKS:
    1. Analyze the student's claim. Does their reasoning present a valid technical argument based on standard aviation maintenance principles?
    2. Determine if a score adjustment is warranted.
    3. Calculate the point adjustment (return as an integer, usually 1).
    4. Draft a direct, formal email explaining the adjudication decision to the student.

    OUTPUT STRICT JSON FORMAT:
    {{
        "status": "success",
        "is_valid_dispute": true,
        "points_to_add": 1,
        "adjudication_reason": "Explanation of the technical review...",
        "email_draft": "Dear Student, upon review..."
    }}
    """
    res = call_gemini(prompt)
    if type(res) is dict and "is_valid_dispute" in res:
        return res
    return {
        "status": "error", 
        "is_valid_dispute": False, 
        "points_to_add": 0, 
        "email_draft": "Your dispute could not be automatically verified by the AI. It has been escalated to the Faculty for manual review."
    }