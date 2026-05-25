// --- MOCK DATABASE & CURRICULUM ---
export const curriculum = {
  "Powerplant": {
    "Engines": { "Reciprocating": ["Radial Engines", "Inline Engines"], "Turbine": ["Turbojet", "Turbofan"] },
    "Systems": ["Fuel Systems", "Ignition Systems"]
  },
  "Airframe": {
    "Structures": ["Sheet Metal", "Composite Materials"],
    "Systems": ["Hydraulics", "Pneumatics", "Landing Gear"]
  },
  "Air Law & Airworthiness": { "Local": ["PCAR Part 5", "PCAR Part 2"], "International": ["EASA Part 66"] },
  "Maintenance Practices": { "Inspections": ["NDT", "Borescope"], "Workshop": ["Tool Control", "Safety"] },
  "Human Performance": { "Psychology": ["Fatigue Management"], "Environment": ["Workspace Layout"] },
  "Math & Physics": { "Aerodynamics": ["Fixed Wing", "Rotary Wing"], "Thermodynamics": ["Gas Laws"] }
};

// Mock Auth Database (Strict Student Access Only)
export const mockUsers = {
  '12324MN-000480': { name: 'YAMADA, Hiromi G.', batch: '2025', section: 'BSAMT 4-7' },
  // Generic fallback if a new student registers
  'NEW-USER': { name: 'Unregistered Candidate', batch: 'TBD', section: 'TBD' }
};

// Mock Analytics Database (Starts empty for live telemetry)
export const mockAnalytics = [];

// Mock Question Bank
export const questionBank = {
  'Lvl 1: Easy': { time: 5 * 60, totalItems: 10, text: "What is the primary purpose of engine oil?", options: ["A. To burn fuel", "B. To lubricate and cool internal parts", "C. To increase compression", "D. To start the engine"], correct: 1, explanation: "At a foundational level, oil reduces friction (lubrication) and dissipates heat (cooling).", referenceText: "Page 12, Paragraph 2 - Lubrication Fundamentals" },
  'Lvl 2: Advanced': { time: 15 * 60, totalItems: 20, text: "Which of the following occurs when the fuel/air mixture ignites prior to the normal spark event?", options: ["A. Detonation", "B. Pre-ignition", "C. Backfiring", "D. Vapor Lock"], correct: 1, explanation: "Pre-ignition is defined as the ignition of the mixture before the spark plug fires, often caused by a hot spot in the cylinder.", referenceText: "Page 28, Paragraph 4 - Abnormal Combustion" },
  'CAAP Exam': { time: 30 * 60, totalItems: 30, text: "During a 100-hour inspection of a radial engine, you discover metallic shavings in the primary oil screen. According to CAAP advisory circulars, what is the immediate mandatory action?", options: ["A. Flush the system and run the engine for 15 mins", "B. Quarantine the filter and perform spectrographic oil analysis", "C. Replace filter and document finding", "D. Contact manufacturer"], correct: 1, explanation: "Metallic shavings indicate critical wear. Spectrographic analysis is legally required to identify the specific metal alloy to pinpoint the failing component.", referenceText: "Page 42, Paragraph 3 - CAAP Mandatory Maintenance Directives" }
};