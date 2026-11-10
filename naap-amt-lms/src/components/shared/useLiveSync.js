import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../apiConfig';

export default function useLiveSync(endpoint, events = [], defaultData = null) {
    const [data, setData] = useState(defaultData);
    const [isLoading, setIsLoading] = useState(true);

    const eventsStr = JSON.stringify(events);

    const fetchData = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            if (!token) {
                setIsLoading(false);
                return;
            }

            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // AUTO-LOGOUT FIX: If token is invalid or expired, clear and exit cleanly
            if (res.status === 401) {
                sessionStorage.clear();
                localStorage.removeItem('token');
                window.location.href = '/login';
                return;
            }

            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            console.warn(`[LiveSync] Background fetch failed for ${endpoint}`);
        } finally {
            setIsLoading(false);
        }
    }, [endpoint]);

    useEffect(() => {
        fetchData();

        const handleWsEvent = (e) => {
            const eventData = e.detail;
            const eventName = eventData?.event || eventData;
            
            if (eventsStr.includes(eventName)) {
                fetchData();
            }
        };

        window.addEventListener('global_ws_event', handleWsEvent);
        return () => window.removeEventListener('global_ws_event', handleWsEvent);
        
    }, [fetchData, eventsStr]);

    return { data, isLoading, mutate: fetchData };
}