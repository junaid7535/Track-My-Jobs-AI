import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

export default function CheckResume() {
  const navigate = useNavigate();
  const { user, resume, fetchResume } = useContext(AppContext);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const checkResume = async () => {
      const resumeData = await fetchResume();
      if (resumeData) {
        navigate('/dashboard');
      } else {
        navigate('/resume-upload');
      }
    };

    checkResume();
  }, [user, fetchResume, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
