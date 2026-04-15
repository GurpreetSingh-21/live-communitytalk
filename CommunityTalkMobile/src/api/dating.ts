// CommunityTalkMobile/src/api/dating.ts
import { AxiosResponse } from 'axios';
import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DatingPreference {
    ageMin: number;
    ageMax: number;
    maxDistance: number;
    showToPeopleOnCampusOnly: boolean;
    interestedInGender: string[];
    preferredColleges?: string[];
}

export interface DatingPhoto {
    id: string;
    url: string;
    isMain: boolean;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface DatingProfile {
    id: string;
    firstName: string;
    age: number;
    bio: string;
    major: string;
    year: string;
    collegeSlug: string;
    hobbies: string[];
    photos: DatingPhoto[];
    preference: DatingPreference | null;
    isPaused: boolean;
    isVerified: boolean;
}

export interface UpdateProfilePayload {
    bio?: string;
    major?: string;
    year?: string;
    hobbies?: string[];
    photos?: { url: string; isMain: boolean }[];
    preferences?: Partial<DatingPreference>;
    pauseProfile?: boolean;
}

export type ReportReason =
    | 'FAKE_PROFILE'
    | 'INAPPROPRIATE_PHOTOS'
    | 'HARASSMENT'
    | 'SPAM'
    | 'UNDERAGE'
    | 'HATE_SPEECH'
    | 'OTHER';

// ── API Module ─────────────────────────────────────────────────────────────────

const DatingAPI = {

    /** Get my own dating profile */
    getMyProfile: async (): Promise<DatingProfile | null> => {
        try {
            const response: AxiosResponse<DatingProfile> = await api.get('/api/dating/profile/me');
            return response.data;
        } catch (error: any) {
            console.error('[DatingAPI] getMyProfile error', error);
            return null;
        }
    },

    /** Create or update dating profile (partial patch supported) */
    updateProfile: async (data: UpdateProfilePayload): Promise<DatingProfile | null> => {
        try {
            const response: AxiosResponse<DatingProfile> = await api.post('/api/dating/profile', data);
            return response.data;
        } catch (error: any) {
            console.error('[DatingAPI] updateProfile error', error);
            throw error;
        }
    },

    /**
     * Permanently delete the user's dating profile and all associated data.
     * GDPR Article 17 / CCPA / App Store 5.1.1 compliant.
     * Backend must: delete profile, photos, matches, messages, and consent records.
     */
    deleteDatingProfile: async (): Promise<boolean> => {
        const response = await api.delete('/api/dating/profile');
        return response.status === 200 || response.status === 204;
    },

    /** Upload a photo and return the CDN URL */
    uploadPhoto: async (base64: string): Promise<string | null> => {
        try {
            const response = await api.post('/api/upload/base64', {
                file: `data:image/jpeg;base64,${base64}`,
                folder: 'community_talk_dating',
            });
            return response.data.url;
        } catch (error) {
            console.error('[DatingAPI] uploadPhoto error', error);
            return null;
        }
    },

    /** Get all mutual matches */
    getMatches: async (): Promise<{ matchId: string; partnerId: string; userId: string; firstName: string; photo: string | null }[]> => {
        try {
            const response = await api.get('/api/dating/matches');
            return response.data;
        } catch (error) {
            console.error('[DatingAPI] getMatches error', error);
            return [];
        }
    },

    /**
     * Report a profile for a safety violation.
     * All reports are logged server-side and trigger the three-strike review system.
     */
    reportProfile: async (targetProfileId: string, reason: ReportReason, details?: string): Promise<void> => {
        await api.post('/api/dating/report', {
            targetProfileId,
            reason,
            details: details?.trim() || null,
        });
    },

    /**
     * Block a user by their user ID.
     * Blocking prevents future matches, hides profiles from each other, and
     * disables existing DM threads between the two users.
     */
    blockUser: async (targetUserId: string): Promise<void> => {
        await api.post('/api/dating/block', { targetUserId });
    },

    /**
     * Unmatch from a mutual match.
     * Removes the match record and disables the DM thread.
     */
    unmatch: async (matchId: string): Promise<void> => {
        await api.delete(`/api/dating/matches/${matchId}`);
    },

    // ── Verification ───────────────────────────────────────────────────────────

    getVerificationPose: async () => {
        const { data } = await api.get('/api/safety/verification/pose');
        return data;
    },

    submitVerification: async (poseId: string, photoUrl: string) => {
        const { data } = await api.post('/api/safety/verification/submit', { poseId, photoUrl });
        return data;
    },

    // ── Messaging ──────────────────────────────────────────────────────────────

    getConversations: async () => {
        const { data } = await api.get('/api/direct-messages?context=dating');
        return data;
    },

    // ── Consent ────────────────────────────────────────────────────────────────

    /** Log ToS consent with version and timestamp for compliance records */
    logConsent: async (tosVersion: string): Promise<void> => {
        await api.post('/api/dating/consent', {
            tosVersion,
            agreedAt: new Date().toISOString(),
        });
    },
};

export default DatingAPI;
