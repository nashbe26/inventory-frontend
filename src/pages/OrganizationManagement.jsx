import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { organizationAPI } from '../services/api';
import { FiUsers, FiMail, FiTrash2, FiUserPlus, FiCopy, FiCheck } from 'react-icons/fi';
import { FaTruck } from 'react-icons/fa';

const OrganizationManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'staff' });
  const [copiedToken, setCopiedToken] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // { userId, userName }
  const [activeTab, setActiveTab] = useState('members');

  // Fetch organization data
  const { data: organization, isLoading, error } = useQuery({
    queryKey: ['my-organization'],
    queryFn: async () => {
      const response = await organizationAPI.getMy();
      return response.data;
    },
    retry: false
  });

  // Redirect to setup if no organization
  useEffect(() => {
    if (error?.response?.status === 404) {
      toast.info('Vous devez créer ou rejoindre une organisation');
      navigate('/setup-organization');
    }
  }, [error, navigate]);

  // Fetch current user to check role
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      // Assuming you have an API endpoint to get the current user
      const response = await organizationAPI.getMe(); 
      return response.data;
    },
  });

  // Fetch invitations
  const { data: invitations } = useQuery({
    queryKey: ['organization-invitations', organization?._id],
    queryFn: async () => {
      const response = await organizationAPI.getInvitations(organization._id);
      return response.data;
    },
    enabled: !!organization?._id
  });

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: (data) => organizationAPI.invite(organization._id, data),
    onSuccess: (response) => {
      toast.success('Invitation créée avec succès!');
      setShowInviteModal(false);
      setInviteData({ email: '', role: 'staff' });
      queryClient.invalidateQueries(['organization-invitations']);
      
      // Generate invite link
      const token = response.data.invitation.token;
      const inviteLink = `${window.location.origin}/setup-organization?token=${token}`;
      
      // Show the invitation link in a better modal
      const copyLink = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success('Lien copié dans le presse-papiers!');
      };
      
      toast.info(
        <div className="space-y-3">
          <p className="font-semibold text-gray-900">Lien d'invitation généré!</p>
          <p className="text-sm text-gray-600">Partagez ce lien avec {inviteData.email}:</p>
          <div className="bg-gray-100 p-2 rounded break-all">
            <code className="text-xs text-blue-600">{inviteLink}</code>
          </div>
          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiCopy /> Copier le lien
          </button>
        </div>,
        { autoClose: false, closeButton: true }
      );
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'envoi de l\'invitation');
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId) => organizationAPI.removeMember(organization._id, userId),
    onSuccess: () => {
      toast.success('Membre retiré avec succès');
      queryClient.invalidateQueries(['my-organization']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors du retrait du membre');
    }
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => organizationAPI.updateMemberRole(organization._id, userId, role),
    onSuccess: () => {
      toast.success('Rôle mis à jour avec succès');
      queryClient.invalidateQueries(['my-organization']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour du rôle');
    }
  });

  const handleInvite = (e) => {
    e.preventDefault();
    inviteMutation.mutate(inviteData);
  };

  const handleRemoveMember = () => {
    if (confirmRemove) {
      removeMemberMutation.mutate(confirmRemove.userId);
      setConfirmRemove(null);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const copyToClipboard = (token) => {
    const inviteLink = `${window.location.origin}/setup-organization?token=${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    toast.success('Lien d\'invitation copié!');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
        return 'bg-green-100 text-green-800';
      case 'delivery_man':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'admin':
        return 'Administrateur';
      case 'manager':
        return 'Manager';
      case 'staff':
        return 'Employé';
      case 'delivery_man':
        return 'Livreur';
      default:
        return role;
    }
  };

  const canEditRole = (currentUserRole, targetUserRole) => {
    if (currentUserRole === 'owner') return true;
    if (currentUserRole === 'admin' && targetUserRole !== 'owner' && targetUserRole !== 'admin') return true;
    return false;
  };

  const availableRoles = (currentUserRole) => {
    if (currentUserRole === 'owner') return ['admin', 'manager', 'staff', 'delivery_man'];
    if (currentUserRole === 'admin') return ['manager', 'staff', 'delivery_man'];
    return [];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Vous ne faites partie d'aucune organisation</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Organization Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
              <p className="text-sm text-gray-500">@{organization.slug}</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                    <FiUsers className="text-gray-400" />
                    <span className="font-medium text-gray-700">
                        {organization.members?.length || 0} membre{(organization.members?.length || 0) > 1 ? 's' : ''}
                    </span>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                >
                    <FiUserPlus size={18} /> Inviter
                </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'members'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Membres
                    </button>
                    <button
                        onClick={() => setActiveTab('invitations')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'invitations'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Invitations en attente
                        {invitations && invitations.length > 0 && (
                            <span className="ml-2 inline-block py-0.5 px-2.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {invitations.length}
                            </span>
                        )}
                    </button>
                </nav>
            </div>
        </div>

        {/* Tab Content */}
        <div>
            {activeTab === 'members' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'adhésion</th>
                                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {organization.members?.map((member) => (
                                <tr key={member._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
                                            <span className="text-white font-bold text-md">
                                                {member.user?.name?.charAt(0).toUpperCase() || '?'}
                                            </span>
                                            </div>
                                            <div className="ml-4">
                                            <div className="text-sm font-semibold text-gray-900">{member.user?.name || 'N/A'}</div>
                                            <div className="text-sm text-gray-500">{member.user?.email || 'N/A'}</div>
                                            {member.role === 'delivery_man' && <div className="text-xs text-yellow-600 mt-1 flex items-center gap-1"><FaTruck size={10} /> Livraison</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {canEditRole(currentUser?.role, member.role) && member.user?._id !== currentUser?._id ? (
                                            <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.user._id, e.target.value)}
                                            disabled={updateRoleMutation.isPending && updateRoleMutation.variables?.userId === member.user?._id}
                                            className={`text-xs border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 ${getRoleBadgeColor(member.role)}`}
                                            >
                                            <option value={member.role} disabled>{getRoleLabel(member.role)}</option>
                                            {availableRoles(currentUser?.role).filter(r => r !== member.role).map(role => (
                                                <option key={role} value={role}>{getRoleLabel(role)}</option>
                                            ))}
                                            </select>
                                        ) : (
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(member.role)}`}>
                                            {getRoleLabel(member.role)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(member.joinedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {member.role !== 'owner' && member.user?._id !== currentUser?._id && (
                                            <button
                                            onClick={() => setConfirmRemove({ userId: member.user?._id, userName: member.user?.name })}
                                            className="text-gray-500 hover:text-red-600 p-2 rounded-full transition-colors"
                                            disabled={removeMemberMutation.isPending && removeMemberMutation.variables === member.user?._id}
                                            >
                                            <FiTrash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'invitations' && (
                <div>
                    {invitations && invitations.length > 0 ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                        {invitations.map((invitation) => (
                            <div key={invitation._id} className="p-4 flex justify-between items-center hover:bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 rounded-full">
                                        <FiMail className="text-gray-500"/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{invitation.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(invitation.role)}`}>
                                                {getRoleLabel(invitation.role)}
                                            </span>
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {invitation.status === 'pending' ? 'En attente' : invitation.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(invitation.token)}
                                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                                >
                                    {copiedToken === invitation.token ? (
                                    <>
                                        <FiCheck className="text-green-600" size={16} />
                                        <span className="text-green-600">Copié!</span>
                                    </>
                                    ) : (
                                    <>
                                        <FiCopy size={16} />
                                        <span>Copier le lien</span>
                                    </>
                                    )}
                                </button>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                            <FiMail className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune invitation en attente</h3>
                            <p className="mt-1 text-sm text-gray-500">Les nouvelles invitations que vous envoyez apparaîtront ici.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Inviter un nouveau membre</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle dans l'organisation
                </label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="staff">Employé - Accès de base</option>      
                  <option value="manager">Manager - Gestion d'équipe</option>
                  <option value="delivery_man">Livreur - Applications de livraison</option>
                  <option value="admin">Administrateur - Accès complet</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {inviteMutation.isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi...
                    </>
                  ) : (
                    <>
                      <FiUserPlus size={18} />
                      Envoyer l'invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Removing Member */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl transform transition-all">
            <h3 className="text-lg font-bold text-gray-900">Confirmer le retrait</h3>
            <p className="mt-2 text-sm text-gray-600">
              Êtes-vous sûr de vouloir retirer <span className="font-medium">{confirmRemove.userName}</span> de l'organisation? Cette action est irréversible.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRemoveMember}
                disabled={removeMemberMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {removeMemberMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrait...
                  </>
                ) : (
                  'Retirer le membre'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationManagement;
