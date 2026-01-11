import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { organizationAPI } from '../services/api';

const OrganizationSetup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const tokenFromUrl = searchParams.get('token');
  const [setupType, setSetupType] = useState(tokenFromUrl ? 'join' : 'create');
  const [formData, setFormData] = useState({
    name: '',
    invitationToken: tokenFromUrl || ''
  });

  // Update token if URL parameter changes
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setSetupType('join');
      setFormData(prev => ({ ...prev, invitationToken: token }));
    }
  }, [searchParams]);

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await organizationAPI.create({ name: formData.name });
      toast.success('Organisation créée avec succès!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la création de l\'organisation');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrganization = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await organizationAPI.acceptInvitation(formData.invitationToken);
      toast.success('Invitation acceptée avec succès!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'acceptation de l\'invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Configuration Organisation
          </h2>
          <p className="text-gray-600">
            Créez votre organisation ou rejoignez une équipe existante
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 gap-0 p-2 bg-gray-50 border-b border-gray-200">
            <button
              onClick={() => setSetupType('create')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                setupType === 'create'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Créer
            </button>
            <button
              onClick={() => setSetupType('join')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                setupType === 'join'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rejoindre
            </button>
          </div>

          {/* Forms Container */}
          <div className="p-8">
            {/* Create Organization Form */}
            {setupType === 'create' && (
              <form onSubmit={handleCreateOrganization} className="space-y-6">
                <div>
                  <label htmlFor="organization-name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom de l'Organisation
                  </label>
                  <input
                    id="organization-name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Ex: Mon Entreprise"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Création...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Créer l'Organisation
                    </>
                  )}
                </button>

                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="font-semibold text-blue-900 text-sm mb-3">Avantages :</p>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Vous êtes le propriétaire</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Invitez des membres illimités</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Données totalement isolées</span>
                    </li>
                  </ul>
                </div>
              </form>
            )}

            {/* Join Organization Form */}
            {setupType === 'join' && (
              <form onSubmit={handleJoinOrganization} className="space-y-6">
                <div>
                  <label htmlFor="invitation-token" className="block text-sm font-semibold text-gray-700 mb-2">
                    Code d'Invitation
                  </label>
                  <textarea
                    id="invitation-token"
                    name="invitationToken"
                    required
                    rows={3}
                    value={formData.invitationToken}
                    onChange={(e) => setFormData({ ...formData, invitationToken: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all font-mono text-sm resize-none"
                    placeholder="Collez le code d'invitation ici..."
                  />
                  <p className="mt-2 text-xs text-gray-500">Le code a été partagé par l'administrateur de l'organisation</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Vérification...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Rejoindre l'Organisation
                    </>
                  )}
                </button>

                <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="font-semibold text-green-900 text-sm mb-3">À savoir :</p>
                  <ul className="space-y-2 text-sm text-green-800">
                    <li className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Valable 7 jours après création</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Accès aux données de l'organisation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Rôle assigné par l'admin</span>
                    </li>
                  </ul>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSetup;
