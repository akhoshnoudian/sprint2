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

interface Course {
  _id: string
  title: string
  description: string
  instructor: {
    username: string
    isVerified: boolean
  }
  level: string
  rating: number
  price: number
  thumbnail: string
  duration: string
}

export const api = {
  // Course endpoints
  async getCourses(): Promise<Course[]> {
    try {
      const token = localStorage.getItem('token')
      console.log('Fetching courses with token:', token)
      const response = await fetch(`${API_BASE_URL}/courses`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        cache: 'no-store',
      })
      console.log('Courses response:', response.status)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to fetch courses')
      }
      const data = await response.json()
      console.log('Fetched courses:', data)
      return data
    } catch (error) {
      console.error('Error fetching courses:', error)
      throw error
    }
  },

  async getCourse(courseId: string): Promise<Course> {
    try {
      const token = localStorage.getItem('token')
      console.log('Fetching course with token:', token)
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        cache: 'no-store',
      })
      console.log('Course response:', response.status)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to fetch course')
      }
      const data = await response.json()
      console.log('Fetched course:', data)
      return data
    } catch (error) {
      console.error('Error fetching course:', error)
      throw error
    }
  },

  // Admin endpoints
  async getInstructors() {
    try {
      const token = localStorage.getItem('token')
      const isAdmin = localStorage.getItem('isAdmin')
      
      if (!token || !isAdmin) {
        throw new Error('Unauthorized: Admin access required')
      }

      console.log('Fetching instructors with token:', token) // Debug log

      const response = await fetch(`${API_BASE_URL}/admin/instructors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch instructors')
      }
      return response.json()
    } catch (error) {
      console.error('Error fetching instructors:', error)
      throw error
    }
  },

  async verifyInstructor(instructorId: string, verify: boolean): Promise<any> {
    try {
      const token = localStorage.getItem('token')
      const isAdmin = localStorage.getItem('isAdmin')
      
      if (!token || !isAdmin) {
        throw new Error('Unauthorized: Admin access required')
      }

      const response = await fetch(`${API_BASE_URL}/admin/instructors/${instructorId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        body: JSON.stringify({ verify }),
      })
      if (!response.ok) {
        throw new Error('Failed to verify instructor')
      }
      return response.json()
    } catch (error) {
      console.error('Error verifying instructor:', error)
      throw error
    }
  },

  // User endpoints
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

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.detail || 'Failed to fetch user info');
    }
    
    return result;
  },

  purchaseCourse: async (courseId: string) => {
    const response = await fetch(`${API_BASE_URL}/courses/${courseId}/purchase`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.detail || 'Failed to purchase course');
    }
    
    return result;
  },
};
