import axios, { AxiosInstance, AxiosError } from 'axios';
import { ConfigManager } from './config';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

interface ApiErrorResponse {
    message?: string;
    code?: string;
  }
  

export class ApiClient {
  private client: AxiosInstance;
  private config: ConfigManager;

  constructor() {
    this.config = ConfigManager.getInstance();
    this.client = axios.create({
      baseURL: this.config.getApiUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      const token = this.config.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Don't set Content-Type for FormData (multipart uploads)
      if (config.data && config.data.constructor && config.data.constructor.name === 'FormData') {
        delete config.headers['Content-Type'];
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const apiError: ApiError = {
            message: (error.response.data as ApiErrorResponse)?.message || error.message,
            code: (error.response.data as ApiErrorResponse)?.code,
            status: error.response.status,
          };
          throw apiError;
        } else if (error.request) {
          throw { message: 'Network error - could not reach server' };
        } else {
          throw { message: error.message };
        }
      }
    );
  }

  public async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }

  public async post<T, D = any>(url: string, data?: D, options?: any): Promise<T> {
    if (options) {
      const response = await this.client.post<T>(url, data, options);
      return response.data;
    }
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  public async put<T, D = any>(url: string, data?: D): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  public async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  public async request<T>(config: any): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }
}

