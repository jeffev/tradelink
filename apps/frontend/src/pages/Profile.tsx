import { useState } from 'react';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/store/auth.store';
import Button from '@/components/UI/Button';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';

export default function Profile() {
  const { user, logout } = useAuthStore();

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await usersService.updateMe({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
      });
      // sync store
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...updated } : s.user }));
      localStorage.setItem('user', JSON.stringify({ ...user, ...updated }));
      toast.success('Perfil atualizado!');
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      const msg = error.response?.data?.message ?? 'Erro ao salvar perfil';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      await usersService.updateMe({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada! Faça login novamente.');
      logout();
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      const msg = error.response?.data?.message ?? 'Erro ao alterar senha';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Meu Perfil</h2>
        <p className="text-sm text-gray-400 mt-0.5">Gerencie suas informações pessoais</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
          {user?.firstName?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-white">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-4">Informações Pessoais</h3>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nome</label>
              <input
                required
                minLength={2}
                value={profileForm.firstName}
                onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sobrenome</label>
              <input
                required
                minLength={2}
                value={profileForm.lastName}
                onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={profileForm.email}
              onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" isLoading={savingProfile}>Salvar</Button>
          </div>
        </form>
      </div>

      {/* Password Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-4">Alterar Senha</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Senha Atual</label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" isLoading={savingPassword} variant="secondary">Alterar Senha</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
