import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  // Note: refreshToken is now stored in httpOnly cookie for security
  // This field is kept for backwards compatibility but should not be used
  refreshToken: string | null;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    accountStatus: string;
    // Profile context from login
    profileId?: string | null;  // For SCHOOL_ADMIN: adminId, for TEACHER: teacherId
    publicId?: string | null;   // Public ID used for login
    schoolId?: string | null;   // Current school context
  } | null;
  tenantId: string | null;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  tenantId: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken?: string; // Optional - now stored in httpOnly cookie
        user: AuthState['user'];
        tenantId?: string;
      }>
    ) => {
      state.token = action.payload.accessToken;
      // Don't store refresh token in state anymore - it's in httpOnly cookie
      // Keep for backwards compatibility during migration
      state.refreshToken = action.payload.refreshToken || null;
      state.user = action.payload.user;
      if (action.payload.tenantId) {
        state.tenantId = action.payload.tenantId;
        if (typeof window !== 'undefined') {
          localStorage.setItem('tenantId', action.payload.tenantId);
        }
      }
    },
    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.tenantId = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tenantId');
      }
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

