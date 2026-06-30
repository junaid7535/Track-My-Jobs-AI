import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export const AppContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const login = async (email, password) => {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Login failed');
  }

  return data.user;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [resume, setResume] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    location: '',
    datePosted: '',
    jobType: '',
    workMode: '',
    matchScore: '',
    skills: [],
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');

    if (savedUser && savedUser !== 'undefined') {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Error parsing saved user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const fetchResume = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/resume`);

      if (!response.ok) {
        if (response.status === 404) {
          setResume(null);
          return null;
        }
        throw new Error('Failed to fetch resume');
      }

      const data = await response.json();
      setResume(data);
      return data;
    } catch (err) {
      console.error('Error fetching resume:', err);
      setResume(null);
      return null;
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/applications`);

      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }

      const data = await response.json();
      const apps = Array.isArray(data) ? data : data.applications || [];
      setApplications(apps);
      return apps;
    } catch (err) {
      console.error('Error fetching applications:', err);
      setApplications([]);
      return [];
    }
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      setContextError('');

      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const loggedInUser = data.user || { email };
      setUser(loggedInUser);
      localStorage.setItem('user', JSON.stringify(loggedInUser));

      await Promise.all([fetchResume(), fetchApplications()]);

      return loggedInUser;
    } catch (err) {
      console.error('Login error:', err);
      setContextError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchApplications, fetchResume]);

  const logout = useCallback(() => {
    setUser(null);
    setResume(null);
    setApplications([]);
    setContextError('');
    setFilters({
      role: '',
      location: '',
      datePosted: '',
      jobType: '',
      workMode: '',
      matchScore: '',
      skills: [],
    });
    localStorage.removeItem('user');
  }, []);

  const uploadResume = useCallback(async (file) => {
    try {
      setIsLoading(true);
      setContextError('');

      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch(`${API_BASE}/api/resume/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Resume upload failed');
      }

      setResume(data);
      return data;
    } catch (err) {
      console.error('Resume upload error:', err);
      setContextError(err.message || 'Resume upload failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchResume(), fetchApplications()]);
  }, [fetchApplications, fetchResume]);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  const value = useMemo(
    () => ({
      user,
      resume,
      applications,
      isLoading,
      error: contextError,
      filters,
      updateFilters,
      login,
      logout,
      uploadResume,
      fetchResume,
      fetchApplications,
      refreshData,
      setApplications,
      setResume,
    }),
    [
      user,
      resume,
      applications,
      isLoading,
      contextError,
      filters,
      updateFilters,
      login,
      logout,
      uploadResume,
      fetchResume,
      fetchApplications,
      refreshData,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};