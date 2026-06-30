import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const DATE_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

const JOB_TYPE_OPTIONS = [
  { value: '', label: 'All job types' },
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
];

const WORK_MODE_OPTIONS = [
  { value: '', label: 'All modes' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Onsite', label: 'Onsite' },
];

const MATCH_SCORE_OPTIONS = [
  { value: '', label: 'Any match score' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SKILLS_OPTIONS = ['React', 'Node.js', 'Python', 'TypeScript', 'AWS', 'SQL'];


function normalizeJob(job) {
  return {
    ...job,
    jobType: job.jobType || 'Full-time',
    workMode:
      job.workMode ||
      (job.location?.toLowerCase().includes('remote') ? 'Remote' : 'Onsite'),
    skills:
      Array.isArray(job.skills) && job.skills.length > 0
        ? job.skills
        : job.title?.toLowerCase().includes('frontend')
        ? ['React', 'CSS', 'JavaScript']
        : job.title?.toLowerCase().includes('backend')
        ? ['Node.js', 'APIs', 'Databases']
        : ['Communication', 'Teamwork', 'Problem Solving'],
    matchScore: Number(job.matchScore || 0),
    matchExplanation:
      job.matchExplanation || 'Matching details are currently unavailable.',
    postedAt: job.postedAt || new Date().toISOString(),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    resume,
    logout,
    uploadResume,
    fetchResume,
    filters,
    updateFilters,
    fetchApplications,
  } = useContext(AppContext);

  const safeFilters = {
    role: '',
    location: '',
    datePosted: '',
    jobType: '',
    workMode: '',
    matchScore: '',
    skills: [],
    ...(filters || {}),
  };

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingApplication, setPendingApplication] = useState(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadJobs();
  }, [user, safeFilters.role, safeFilters.location, resume?.id]);

  const loadJobs = async () => {
    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const query = new URLSearchParams();

      if (safeFilters.role) {
      query.set('search', safeFilters.role);
    }

    if (safeFilters.location) {
      query.set('location', safeFilters.location);
    }

    if (resume?.id) {
      query.set('resumeId', resume.id);
    }

    const response = await fetch(`${API_BASE}/api/jobs?${query.toString()}`);
const raw = await response.text();

let data;
try {
  data = JSON.parse(raw);
} catch {
  setJobs([]);
  setError(raw || 'Server returned invalid response');
  setInfoMessage('');
  return;
}

if (!response.ok || !data.success) {
  setJobs([]);
  setError(data.message || 'Failed to load live jobs.');
  setInfoMessage('');
  return;
}

setJobs(data.jobs || []);
setInfoMessage(data.source === 'mock' ? 'Showing fallback jobs.' : '');
  if (data.source === 'mock') {
  setInfoMessage('Showing fallback jobs. Live jobs are not available right now.');
  } else {
  setInfoMessage('Showing live jobs.');
  }
  
  } catch (err) {
    console.error('Fetch jobs error:', err);
    setJobs([]);
    setError('Could not connect to jobs API.');
    setInfoMessage('');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  if (!user) return;

  const timer = setTimeout(() => {
    loadJobs();
  }, 700);

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      const pending = localStorage.getItem('pendingApplication');
      if (pending) {
        try {
          const app = JSON.parse(pending);
          setPendingApplication(app);
          setShowApplicationModal(true);
        } catch (err) {
          console.error('Error parsing pending application:', err);
        }
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [user, safeFilters.role, safeFilters.location, resume?.id]);

  const handleLogout = () => {
    if (logout) logout();
    navigate('/login');
  };

  const handleApply = (job) => {
    if (job.applyUrl) {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
    }

    const pending = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      applyUrl: job.applyUrl,
      timestamp: Date.now(),
    };

    localStorage.setItem('pendingApplication', JSON.stringify(pending));
  };

  const handleApplicationResponse = async (responseType) => {
    if (!pendingApplication) return;

    setApplicationError('');

    try {
      if (responseType === 'yes' || responseType === 'earlier') {
        const applicationData = {
          jobId: pendingApplication.jobId,
          jobTitle: pendingApplication.jobTitle,
          company: pendingApplication.company,
          applyUrl: pendingApplication.applyUrl,
          status: 'Applied',
          appliedAt:
            responseType === 'earlier'
              ? new Date(pendingApplication.timestamp - 86400000).toISOString()
              : new Date().toISOString(),
          timeline: [
            {
              event: responseType === 'earlier' ? 'Applied earlier' : 'Applied',
              timestamp: new Date().toISOString(),
            },
          ],
        };

        const res = await fetch(`${API_BASE}/api/applications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(applicationData),
        });

        if (!res.ok) {
          const errorText = await res.text();
          setApplicationError(
            'Failed to save application: ' + (errorText || 'Unknown error')
          );
          return;
        }

        if (fetchApplications) {
          await fetchApplications();
        }
      }

      localStorage.removeItem('pendingApplication');
      setPendingApplication(null);
      setShowApplicationModal(false);
    } catch (err) {
      console.error('Error saving application:', err);
      setApplicationError('Error saving application: ' + err.message);
    }
  };

  const handleReplaceResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      if (uploadResume) await uploadResume(file);
      if (fetchResume) await fetchResume();
      setSuccess('Resume uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error uploading resume: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFilterChange = (key, value) => {
    if (!updateFilters) return;
    updateFilters({ [key]: value });
  };

  const toggleSkill = (skill) => {
    const currentSkills = safeFilters.skills || [];
    const hasSkill = currentSkills.includes(skill);

    if (!updateFilters) return;

    updateFilters({
      skills: hasSkill
        ? currentSkills.filter((s) => s !== skill)
        : [...currentSkills, skill],
    });
  };

  const filterJobs = (job) => {
    const role = safeFilters.role || '';
    const location = safeFilters.location || '';
    const datePosted = safeFilters.datePosted || '';
    const jobType = safeFilters.jobType || '';
    const workMode = safeFilters.workMode || '';
    const matchScore = safeFilters.matchScore || '';
    const selectedSkills = safeFilters.skills || [];

    if (role) {
    const roleValue = role.toLowerCase().trim();

    const aliases = {
    'software engineer': ['engineer', 'developer', 'software', 'full stack', 'backend', 'frontend'],
    'frontend developer': ['frontend', 'react', 'ui'],
    'backend developer': ['backend', 'api', 'node', 'server'],
    'full stack': ['full stack', 'frontend', 'backend', 'react', 'node'],
    };

    const terms = aliases[roleValue] || roleValue.split(/\s+/);

    const searchableText = [
      job.title || '',
      job.description || '',
      job.company || '',
      ...(job.skills || []),
  ]
    .join(' ')
    .toLowerCase();

    const hasMatch = terms.some((term) => searchableText.includes(term.toLowerCase()));

    if (!hasMatch) return false;
  }

    if (location) {
      const locationValue = location.toLowerCase();
      if (!job.location?.toLowerCase().includes(locationValue)) return false;
    }

    if (datePosted) {
      const days = parseInt(datePosted, 10);
      const jobDate = new Date(job.postedAt);
      const daysSincePosted =
        (Date.now() - jobDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePosted > days) return false;
    }

    if (jobType && job.jobType !== jobType) return false;
    if (workMode && job.workMode !== workMode) return false;

    if (matchScore) {
      const score = Number(job.matchScore || 0);
      if (matchScore === 'high' && score < 70) return false;
      if (matchScore === 'medium' && (score < 40 || score >= 70)) return false;
      if (matchScore === 'low' && score >= 40) return false;
    }

    if (selectedSkills.length > 0) {
      const jobSkills = job.skills || [];
      const hasAllSkills = selectedSkills.every((skill) =>
        jobSkills.some((jobSkill) =>
          jobSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      if (!hasAllSkills) return false;
    }

    return true;
  };

  const displayedJobs = Array.isArray(jobs) ? jobs.filter(filterJobs) : [];

  const bestMatches = [...jobs]
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 6);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
            <p className="text-sm text-gray-600">Welcome, {user.email}</p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate('/applications')}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              📋 Applications
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={handleReplaceResume}
        className="hidden"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {!error && infoMessage && (
          <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            {infoMessage}
          </div>
        )}

        {applicationError && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {applicationError}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {resume ? (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-blue-900">
                  <strong>Current Resume:</strong> {resume.filename} (uploaded{' '}
                  {new Date(resume.uploadedAt).toLocaleDateString()})
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Keep your resume up to date for better job matches.
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {uploading ? 'Updating...' : 'Replace Resume'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-yellow-900 font-semibold mb-2">
                  No resume uploaded yet
                </p>
                <p className="text-xs text-yellow-700">
                  Upload your resume to get AI-powered job matching and recommendations.
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition whitespace-nowrap"
              >
                {uploading ? 'Uploading...' : 'Upload Resume'}
              </button>
            </div>
          </div>
        )}

        {jobs.length > 0 && (
          <section className="mb-8 bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Best Matches</h2>

            {!resume ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-2">
                  Upload your resume to see personalized job matches
                </p>
                <p className="text-sm text-gray-500">
                  Get AI-powered recommendations based on your experience and skills
                </p>
              </div>
            ) : bestMatches.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {bestMatches.map((job) => (
                  <article
                    key={`best-${job.id}`}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {job.title}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          job.matchScore > 70
                            ? 'bg-green-100 text-green-700'
                            : job.matchScore >= 40
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {job.matchScore}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{job.company}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {job.matchExplanation}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No strong matches found yet</p>
                <p className="text-sm text-gray-500">
                  Try updating your resume or adjusting your filters
                </p>
              </div>
            )}
          </section>
        )}

        <section className="mb-8 bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Filters</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Role / Title"
              value={safeFilters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="text"
              placeholder="Location"
              value={safeFilters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={safeFilters.datePosted}
              onChange={(e) => handleFilterChange('datePosted', e.target.value)}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={safeFilters.jobType}
              onChange={(e) => handleFilterChange('jobType', e.target.value)}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {JOB_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={safeFilters.workMode}
              onChange={(e) => handleFilterChange('workMode', e.target.value)}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WORK_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={safeFilters.matchScore}
              onChange={(e) => handleFilterChange('matchScore', e.target.value)}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MATCH_SCORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SKILLS_OPTIONS.map((skill) => {
              const selected = (safeFilters.skills || []).includes(skill);

              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    selected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Job Feed</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading jobs...</p>
            </div>
          ) : displayedJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-2">
                {jobs.length === 0
                  ? 'No jobs available right now. Check back soon.'
                  : 'No jobs match your current filters.'}
              </p>

              {jobs.length > 0 && (
                <button
                  onClick={() =>
                    updateFilters &&
                    updateFilters({
                      role: '',
                      skills: [],
                      datePosted: '',
                      jobType: '',
                      workMode: '',
                      location: '',
                      matchScore: '',
                    })
                  }
                  className="text-blue-600 hover:text-blue-800 text-sm underline mt-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {displayedJobs.map((job) => (
                <article
                  key={job.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 flex flex-col"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {job.title}
                      </h3>
                      <p className="text-sm text-blue-600 font-medium">
                        {job.company}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        job.matchScore > 70
                          ? 'bg-green-100 text-green-700'
                          : job.matchScore >= 40
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {Number(job.matchScore || 0).toFixed(0)}%
                    </span>
                  </div>

                  <div className="mb-4 space-y-1 text-sm text-gray-600">
                    <p>📍 {job.location}</p>
                    <p>
                      🕒 {job.jobType} · {job.workMode}
                    </p>
                    <p>🗓 {new Date(job.postedAt).toLocaleDateString()}</p>
                  </div>

                  <p className="text-gray-700 text-sm mb-2 line-clamp-3">
                    {job.description}
                  </p>

                  <p className="text-xs text-gray-600 mb-3 line-clamp-3">
                    {job.matchExplanation}
                  </p>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {(job.skills || []).map((skill) => (
                      <span
                        key={`${job.id}-${skill}`}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="mt-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition"
                    onClick={() => handleApply(job)}
                  >
                    Apply
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showApplicationModal && pendingApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Did you apply to {pendingApplication.jobTitle} at{' '}
              {pendingApplication.company}?
            </h3>

            <div className="space-y-3">
              <button
                onClick={() => handleApplicationResponse('yes')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Yes, Applied
              </button>

              <button
                onClick={() => handleApplicationResponse('no')}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                No, just browsing
              </button>

              <button
                onClick={() => handleApplicationResponse('earlier')}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Applied Earlier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}