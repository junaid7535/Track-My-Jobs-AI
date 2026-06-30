import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const STATUS_OPTIONS = ['Applied', 'Interview', 'Offer', 'Rejected'];

export default function Applications() {
  const navigate = useNavigate();
  const { user, applications, fetchApplications } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchApplications().finally(() => setLoading(false));
  }, [user, navigate, fetchApplications]);

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch(`/api/applications/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        // Refresh the global applications state
        await fetchApplications();
      } else {
        setError('Failed to update status');
      }
    } catch (err) {
      setError('Error updating status: ' + err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
            <p className="text-sm text-gray-600">Track your job applications</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No applications yet. Start applying to jobs!</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {applications.map((app) => (
              <article key={app.id} className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{app.jobTitle}</h3>
                  <p className="text-sm text-blue-600 font-medium">{app.company}</p>
                  <div className="mt-2">
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value)}
                      className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Timeline</h4>
                  <div className="space-y-2">
                    {app.timeline.map((event, index) => (
                      <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <p>{event.event}</p>
                        <p className="text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {app.applyUrl && (
                  <a
                    href={app.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    View Application
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}