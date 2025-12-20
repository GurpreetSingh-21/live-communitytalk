// Add this to CommunityTalkMobile/app/(tabs)/communities.tsx
// Replace the useEffect starting at line ~398

useEffect(() => {
    const ac = new AbortController();

    (async () => {
        // 1. Load cache INSTANTLY (0ms!)
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const cached = await AsyncStorage.getItem('@communities_cache_v1');
            if (cached) {
                const data = JSON.parse(cached);
                console.log('[Communities] 📦 Loaded from cache', data.length);
                setThreads(resortByPinnedAndRecent(data));
                setIsLoading(false); // Show immediately!
            } else {
                setIsLoading(true); // First time, show loader
            }
        } catch (e) {
            console.log('[Communities] Cache load failed', e);
            setIsLoading(true);
        }

        // 2. Fetch fresh data in background
        const communities = await fetchCommunityThreads(ac.signal);
        await refreshUnread?.();

        // 3. Update UI
        setThreads(resortByPinnedAndRecent(communities));
        setIsLoading(false);

        // 4. Save to cache
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.setItem('@communities_cache_v1', JSON.stringify(communities));
            console.log('[Communities] 💾 Saved to cache');
        } catch (e) {
            console.log('[Communities] Cache save failed', e);
        }
    })();

    return () => ac.abort();
}, [fetchCommunityThreads, refreshUnread]);


// Also add cache clearing on logout in AuthContext
// In the logout function:
await AsyncStorage.removeItem('@communities_cache_v1');
