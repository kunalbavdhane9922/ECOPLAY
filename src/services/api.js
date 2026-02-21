import axios from 'axios';

// Use Render deployment in production, fall back to localhost in dev
export const BACKEND_URL = import.meta.env.DEV
    ? 'http://localhost:5000'
    : 'https://ecoplay-k964.onrender.com';

const API_URL = `${BACKEND_URL}/api`;

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
});

// Auth interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
        }
        return Promise.reject(error);
    }
);

// ========== AUTH ==========
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
};

// ========== USERS ==========
export const userAPI = {
    getProfile: () => api.get('/users/profile'),
    updateProfile: (data) => api.put('/users/profile', data),
    getLeaderboard: (params) => api.get('/users/leaderboard', { params }),
    getImpactOverview: () => api.get('/users/impact-overview'),
    getUserById: (id) => api.get(`/users/${id}`),
};

// ========== REPORTS ==========
export const reportAPI = {
    submitReport: (data) => api.post('/reports', data),
    getReports: (params) => api.get('/reports', { params }),
    getMyReports: () => api.get('/reports/my'),
    getReportById: (id) => api.get(`/reports/${id}`),
    verifyReport: (id, data) => api.post(`/reports/${id}/verify`, data),
};

// ========== TASKS ==========
export const taskAPI = {
    getNearbyTasks: (params) => api.get('/tasks/nearby', { params }),
    getClanTasks: () => api.get('/tasks/clan'),
    getMyTasks: () => api.get('/tasks/my'),
    getAllTasks: (params) => api.get('/tasks', { params }),
    acceptTask: (id) => api.post(`/tasks/${id}/accept`),
    completeTask: (id, data) => api.post(`/tasks/${id}/complete`, data),
    joinMission: (mapPinId) => api.post('/tasks/join', { mapPinId }),
    verifyMission: (taskId) => api.delete(`/tasks/${taskId}/verify`),
};

// ========== CLANS ==========
export const clanAPI = {
    getAllClans: (params) => api.get('/clans', { params }),
    getNearbyClans: (params) => api.get('/clans/nearby', { params }),
    getMyClan: () => api.get('/clans/my'),
    getClanById: (id) => api.get(`/clans/${id}`),
    createClan: (data) => api.post('/clans', data),
    joinClan: (id) => api.post(`/clans/${id}/join`),
    leaveClan: (id) => api.post(`/clans/${id}/leave`),
    addDrive: (id, data) => api.post(`/clans/${id}/drives`, data),
    joinDrive: (clanId, driveId) => api.post(`/clans/${clanId}/drives/${driveId}/join`),
    getLeaderboard: () => api.get('/clans/leaderboard/global'),
    approveMember: (clanId, userId) => api.post(`/clans/${clanId}/requests/${userId}/approve`),
    rejectMember: (clanId, userId) => api.post(`/clans/${clanId}/requests/${userId}/reject`),
    inviteUser: (clanId, username) => api.post(`/clans/${clanId}/invite`, { username }),
    respondInvite: (clanId, accept) => api.post(`/clans/invites/${clanId}/respond`, { accept }),
    getMyInvites: () => api.get('/clans/my-invites'),
    getActivities: (clanId) => api.get(`/clans/${clanId}/activities`),
    proposeActivity: (clanId, data) => api.post(`/clans/${clanId}/activities`, data),
    joinActivity: (clanId, actId) => api.post(`/clans/${clanId}/activities/${actId}/join`),
    unjoinActivity: (clanId, actId) => api.post(`/clans/${clanId}/activities/${actId}/unjoin`),
    completeActivity: (clanId, actId) => api.post(`/clans/${clanId}/activities/${actId}/complete`),
    // Clan Tasks (leader-created, member-approved)
    createClanTask: (clanId, data) => api.post(`/clans/${clanId}/tasks`, data),
    getMyClanTasks: () => api.get('/clans/my-tasks/clan'),
    approveClanTask: (taskId) => api.post(`/clans/tasks/${taskId}/approve`),
};

// ========== MAP ==========
export const mapAPI = {
    getPins: () => api.get('/maps'),
    addPin: (data) => api.post('/maps', data),
};

// ========== UPLOAD ==========
export const uploadAPI = {
    uploadImage: async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const res = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res;
    },
};

// BACKEND_URL is already a named export above
export default api;
