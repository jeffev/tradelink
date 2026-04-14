import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';
import Button from '@/components/UI/Button';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      navigate('/dashboard');
    } catch (err) {
      const error = err as AxiosError<ApiError>;
      const msg = error.response?.data?.message ?? 'Erro ao criar conta';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Tradelink</h1>
          <p className="text-gray-400 mt-2 text-sm">Crie sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Nome</label>
              <input
                name="firstName"
                required
                minLength={2}
                value={form.firstName}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="João"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Sobrenome</label>
              <input
                name="lastName"
                required
                minLength={2}
                value={form.lastName}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Silva"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Senha</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="mínimo 6 caracteres"
            />
          </div>
          <Button type="submit" isLoading={isLoading} className="w-full justify-center">
            Criar conta
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
