import React, { useState } from 'react';
import { addToWaitlist } from '../lib/waitlist';

interface WaitlistFormProps {
  onSuccess: (email: string) => void;
}

export default function WaitlistForm({ onSuccess }: WaitlistFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.firstName.trim()) {
      setError('Le prénom est requis');
      setLoading(false);
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Le nom est requis');
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('L\'email est requis');
      setLoading(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email invalide');
      setLoading(false);
      return;
    }

    try {
      const result = addToWaitlist(formData.firstName, formData.lastName, formData.email);
      setSuccess(true);
      onSuccess(result.email);
      setFormData({ firstName: '', lastName: '', email: '' });
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError('Une erreur s\'est produite. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          name="firstName"
          placeholder="Prénom"
          value={formData.firstName}
          onChange={handleChange}
          className="px-4 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-gold)] bg-white text-[var(--text-dark)]"
          disabled={loading}
        />
        <input
          type="text"
          name="lastName"
          placeholder="Nom"
          value={formData.lastName}
          onChange={handleChange}
          className="px-4 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-gold)] bg-white text-[var(--text-dark)]"
          disabled={loading}
        />
      </div>

      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full px-4 py-3 border border-[rgba(197,161,72,0.3)] rounded-lg focus:outline-none focus:border-[var(--greek-gold)] bg-white text-[var(--text-dark)]"
        disabled={loading}
      />

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg text-sm">
          ✓ Inscription réussie!
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary-greek w-full text-lg py-3 disabled:opacity-50"
      >
        {loading ? 'En cours...' : 'Rejoindre la Waitlist'}
      </button>
    </form>
  );
}
