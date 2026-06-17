import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "https://msl-backend-y6m5.onrender.com/api";

// 

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ================= AUTH =================
export const authService = {
  login: (employeeId, password) =>
    api.post("/login", { employee_id: employeeId, password }),
};

// ================= DOCTOR =================
export const doctorService = {
  getDoctors: (priorityOnly = false) =>
    api.get(`/doctors?priority_only=${priorityOnly}`),
  getDoctor: (id) => api.get(`/doctors/${id}`),
  createDoctor: (data) => api.post("/doctors", data),
  duplicateDoctor: (id) => api.post(`/doctors/${id}/duplicate`),
  deleteDoctor: (id) => api.delete(`/doctors/${id}`),
  
  // Cascading dropdown APIs for BL location-based filtering
  getRegionsByBL: (blTerritory = null) => {
    const params = new URLSearchParams();
    if (blTerritory) params.append("bl_territory", blTerritory);
    return api.get(`/doctors/regions?${params.toString()}`);
  },
  
  getTerritoriesByRegion: (region, blTerritory = null) => {
    const params = new URLSearchParams();
    params.append("region", region);
    if (blTerritory) params.append("bl_territory", blTerritory);
    return api.get(`/doctors/territories?${params.toString()}`);
  },
  
  getPatchesByTerritory: (territory, region = null, blTerritory = null) => {
    const params = new URLSearchParams();
    params.append("territory", territory);
    if (region) params.append("region", region);
    if (blTerritory) params.append("bl_territory", blTerritory);
    return api.get(`/doctors/patches?${params.toString()}`);
  },
  
  getDoctorsByLocation: (region = null, territory = null, patch = null, blTerritory = null) => {
    const params = new URLSearchParams();
    if (region) params.append("region", region);
    if (territory) params.append("territory", territory);
    if (patch) params.append("patch", patch);
    if (blTerritory) params.append("bl_territory", blTerritory);
    return api.get(`/doctors/by-location?${params.toString()}`);
  },
};

// ================= REQUEST =================
export const requestService = {
  getRequests: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.requested_by)
      queryParams.append("requested_by", params.requested_by);
    if (params.role) queryParams.append("role", params.role);
    if (params.username) queryParams.append("username", params.username);

    return api.get(`/requests?${queryParams.toString()}`);
  },
  getRequest: (id, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.role) queryParams.append("role", params.role);
    if (params.username) queryParams.append("username", params.username);
    
    return api.get(`/requests/${id}?${queryParams.toString()}`);
  },
  assignRequest: (id, data) => {
    return api.put(`/requests/${id}/assign`, data);
  },
  createRequest: (data) => {
    console.log(
      "API createRequest - data being sent:",
      JSON.stringify(data, null, 2),
    );
    return api.post("/requests", data);
  },

  /**
   * Update request user classification
   * Backend expects: PUT /api/requests/{id}/user-classification?user_classification={value}
   * Valid values: 'potential', 'non-potential', 'default'
   *
   * Why this approach:
   * - The backend uses Query(...) which means it expects query parameters, not request body
   * - Axios PUT with params sends query parameters correctly
   * - We pass null as data since backend doesn't expect a body
   */
  updateStatus: async (id, status) => {
    // Validate inputs before making the request
    if (!id) {
      throw new Error("Request ID is required");
    }
    if (!status) {
      throw new Error("Status value is required");
    }

    const validStatuses = ["potential", "non-potential", "default"];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status: "${status}". Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    const url = `/requests/${id}/user-classification`;
    const params = { user_classification: status };

    console.log(`[API] PUT ${url}`, { user_classification: status });

    try {
      // PUT with query params - pass null as request body
      const response = await api.put(url, null, { params });
      console.log(`[API] Status update successful:`, response.data);
      return response;
    } catch (error) {
      // Enhanced error logging for debugging
      console.error(`[API] Status update failed for request ${id}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        params: error.config?.params,
      });
      throw error;
    }
  },

  /**
   * Update per-brand RX status
   * @param {number} id - Request ID
   * @param {object} data - Object containing rx_status_brand1 and/or rx_status_brand2
   */
  updateBrandStatus: async (id, data) => {
    const url = `/requests/${id}/rx-status`;
    console.log(`[API] PUT ${url}`, data);
    try {
      const response = await api.put(url, data);
      console.log(`[API] Brand status update successful:`, response.data);
      return response;
    } catch (error) {
      console.error(`[API] Brand status update failed for request ${id}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  },

  getLogs: (id) => api.get(`/requests/${id}/logs`),
};

// ================= INTERACTION =================
export const interactionService = {
  createInteraction: (data) => api.post("/doctor-interactions", data),

  getInteractions: (requestId) =>
    api.get(`/requests/${requestId}/interactions`),

  // Doctor History — all MSLs who visited this doctor
  getDoctorHistory: (doctorName) =>
    api.get(`/doctor-interactions/by-doctor?doctor_name=${encodeURIComponent(doctorName)}`),

  // Get interactions by date and user
  getInteractionsByDateUser: (visitDate, loggedBy) =>
    api.get(`/doctor-interactions/by-date-user?visit_date=${encodeURIComponent(visitDate)}&logged_by=${encodeURIComponent(loggedBy)}`),
};

// ================= OFFICE ACTIVITY =================
export const activityService = {
  createActivity: (data) => api.post("/office-activities", data),

  getActivities: (mslUsername = null) => {
    const url = mslUsername
      ? `/office-activities?msl_username=${encodeURIComponent(mslUsername)}`
      : "/office-activities";

    return api.get(url);
  },

  getActivityUsers: () => api.get("/office-activities/users"),
};

// ================= REPORTS =================
export const reportService = {
  getMonthlySummary: (month, year, employeeIds = null) => {
    const params = new URLSearchParams();
    params.append("month", month);
    params.append("year", year);
    if (employeeIds) {
      params.append("employee_ids", employeeIds);
    }
    return api.get(`/reports/monthly-summary?${params.toString()}`);
  },
};

// ================= USERS =================
export const userService = {
  getUsers: () => api.get("/users"),
  getMslUsers: () => api.get("/users/msls"),
};

export default api;
