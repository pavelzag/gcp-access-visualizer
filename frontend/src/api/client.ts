import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

export interface User {
  email: string;
  type: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  location: string;
  iam: Record<string, string[]>;
}

export interface AccessEntry {
  userEmail: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  roles: string[];
}

export interface AccessMatrix {
  users: User[];
  resources: Resource[];
  access: AccessEntry[];
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users');
    return response.data;
  },

  getResources: async (): Promise<Resource[]> => {
    const response = await api.get<Resource[]>('/resources');
    return response.data;
  },

  getAccessMatrix: async (): Promise<AccessMatrix> => {
    const response = await api.get<AccessMatrix>('/access');
    return response.data;
  },

  healthCheck: async (): Promise<{ status: string }> => {
    const response = await api.get<{ status: string }>('/health');
    return response.data;
  },
};
