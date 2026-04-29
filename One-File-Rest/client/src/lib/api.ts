class APIClient {
  private baseURL: string;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, headers);
  }

  post<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', endpoint, data, headers);
  }

  put<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('PUT', endpoint, data, headers);
  }

  patch<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, headers);
  }

  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, headers);
  }
}

export default new APIClient();
