const API_BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000';

// Log for debugging
console.log('API_BASE_URL:', API_BASE_URL);

interface SignupData {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'instructor';
}

interface LoginData {
  email: string;
  password: string;
}

interface CourseData {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  price: number;
  ratings: number;
  video_urls: string[];
}

export const api = {
  signup: async (data: SignupData) => {
    console.log('Sending signup request:', data);
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }
    
    return response.json();
  },

  login: async (data: LoginData) => {
    try {
      console.log('Attempting login with:', { ...data, password: '***' });
      console.log('API URL:', `${API_BASE_URL}/login`);
      
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await response.json();
      console.log('Login response body:', result);
      
      if (!response.ok) {
        throw new Error(result.detail || 'Login failed');
      }
      
      return result;
    } catch (error) {
      console.error('Login error details:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  },

  getCourses: async () => {
    const response = await fetch(`${API_BASE_URL}/courses`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      cache: 'no-store',
    });
    return response.json();
  },

  createCourse: async (data: CourseData) => {
    const response = await fetch(`${API_BASE_URL}/create-course`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.detail || 'Failed to create course');
    }
    
    return result;
  },

  uploadVideo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.detail || 'Failed to upload video');
    }
    
    return result;
  },
};
