// CommunityTalkMobile/src/api/dating.ts
import { AxiosResponse } from 'axios';
import { api } from './api';

// Types (should ideally be shared or in types/dating.ts)
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
    age: number; // or birthDate
    bio: string;
    major: string;
    year: string;
    collegeSlug: string;
    hobbies: string[];
    photos: DatingPhoto[];
    preference: DatingPreference | null;
    isPaused: boolean;
}

export interface UpdateProfilePayload {
    bio?: string;
    major?: string;
    year?: string;
    hobbies?: string[];
    photos?: { url: string; isMain: boolean }[]; // We send simpler objects for replace
    preferences?: Partial<DatingPreference>;
    isPaused?: boolean; // TODO: Backend support for this specific toggle?
    // Account actions
    pauseProfile?: boolean; // Alternate way if field is boolean
}

const DatingAPI = {
    /**
     * Get my profile
     */
    getMyProfile: async (): Promise<DatingProfile | null> => {
        try {
            const response: AxiosResponse<DatingProfile> = await api.get('/api/dating/profile/me');
            return response.data;
        } catch (error: any) {
            console.error('[DatingAPI] getMyProfile error', error);
            return null;
        }
    },

    /**
     * Update profile (partial)
     */
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
     * Delete Account (Dating Profile only?)
     */
    deleteDatingProfile: async (): Promise<boolean> => {
        // TODO: Implement DELETE endpoint in backend
        console.warn('DELETE not implemented yet');
        return false;
    },

    /**
     * Upload photo helper
     */
    uploadPhoto: async (base64: string): Promise<string | null> => {
        try {
            const response = await api.post('/api/upload/base64', {
                file: `data:image/jpeg;base64,${base64}`, // Ensure prefix if missing, or handle in component
                folder: 'community_talk_dating'
            });
            return response.data.url;
        } catch (error) {
            console.error('[DatingAPI] uploadPhoto error', error);
            return null;
        }
    },

    /**
     * Get Matches
     */
    getMatches: async (): Promise<{ matchId: string, partnerId: string, userId: string, firstName: string, photo: string | null }[]> => {
        try {
            const response = await api.get('/api/dating/matches');
            return response.data;
        } catch (error) {
            console.error('[DatingAPI] getMatches error', error);
            return [];
        }
    },

  // ...
  
  // Verification
  getVerificationPose: async () => {
    const { data } = await api.get('/api/safety/verification/pose');
    return data; // { id, instruction, referenceImageUrl }
  },
  
  submitVerification: async (poseId: string, photoUrl: string) => {
    const { data } = await api.post('/api/safety/verification/submit', { poseId, photoUrl });
    return data;
  },

  // Messages
  getConversations: async () => {
      const { data } = await api.get('/api/direct-messages?context=dating');
      return data; // List of threads with lastMessage
  },

};

export default DatingAPI;
