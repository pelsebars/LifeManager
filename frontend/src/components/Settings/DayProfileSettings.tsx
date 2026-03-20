/**
 * BL-27: Day Profile settings UI
 *
 * Lets the user configure free_hours (and optionally work_hours / commute_hours)
 * for each of the three day types: workday, weekend, vacation.
 * Saved changes propagate immediately to the load bar via the planningStore.
 */

import { useEffect, useState } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import type { DayProfile } from '../../types';

type DayType = 'workday' | 'weekend' | 'vacation';

const DAY_TYPE_LABELS: Record<DayType, { label: string; icon: string; desc: string }> = {
  workday:  { label: 'Work day',   icon: '💼', desc: 'Mon – Fri' },
  weekend:  { label: 'Weekend',    icon: '🌿', desc: 'Sat – Sun' },
  vacation: { label: 'Vacation',   icon: '✈️', desc: 'Holiday / time off' },
};

interface ProfileForm {
  work_hours: number;
  commute_hours: number;
  free_hours: number;
}

function profileToForm(p: DayProfile): ProfileForm {
  return { work_hours: p.work_hours, commute_hours: p.commute_hours, free_hours: p.free_hours };
}

function ProfileCard({ dayType, profile, onSave }: {
  dayType: DayType;
  profile: DayProfile;
  onSave: (form: ProfileForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ProfileForm>(profileToForm(profile));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const meta = DAY_TYPE_LABELS[dayType];

  // Reset if parent profile changes (e.g. after initial API load)
  useEffect(() => {
    setForm(profileToForm(profile));
    setDirty(false);
  }, [profile.free_hours, profile.work_hours, profile.commute_hours]);

  const setField = (field: keyof ProfileForm, raw: string) => {
    const val = Math.max(0, Math.min(24, parseFloat(raw) || 0));
    setForm((f) => ({ ...f, [field]: val }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // Derived: hours actually available after work + commute
  const computed = Math.max(0, 24 - form.work_hours - form.commute_hours);

  return (
    <div style={{
      background: 'white', borderRadius: 10, padding: '1.25rem 1.5rem',
      border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <span style={{ fontSize: 22 }}>{meta.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{meta.label}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{meta.desc}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <NumberField
          label="Work hours"
          hint="hrs in paid work"
          value={form.work_hours}
          onChange={(v) => setField('work_hours', v)}
        />
        <NumberField
          label="Commute hours"
          hint="hrs lost to travel"
          value={form.commute_hours}
          onChange={(v) => setField('commute_hours', v)}
        />
        <NumberField
          label="Free hours"
          hint="hrs for personal tasks"
          value={form.free_hours}
          onChange={(v) => setField('free_hours', v)}
          highlight
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
        Non-work hours: {computed.toFixed(1)} h/day
        {' · '}
        Free hours used for load bar calculation
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            padding: '7px 20px', borderRadius: 6, border: 'none',
            background: dirty && !saving ? '#4a9eff' : '#e5e7eb',
            color: dirty && !saving ? 'white' : '#9ca3af',
            fontWeight: 600, fontSize: 13, cursor: dirty && !saving ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Saved ✓</span>}
        {dirty && !saved && <span style={{ fontSize: 12, color: '#f59e0b' }}>Unsaved changes</span>}
      </div>
    </div>
  );
}

function NumberField({ label, hint, value, onChange, highlight }: {
  label: string; hint: string; value: number; onChange: (v: string) => void; highlight?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: highlight ? '#1d4ed8' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <input
          type="number" min={0} max={24} step={0.5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', minWidth: 70, padding: '8px 28px 8px 10px', borderRadius: 6,
            border: `1.5px solid ${highlight ? '#93c5fd' : '#e5e7eb'}`,
            fontSize: 15, fontWeight: highlight ? 700 : 400,
            color: highlight ? '#1d4ed8' : '#111',
            background: highlight ? '#eff6ff' : 'white',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af', pointerEvents: 'none' }}>
          h
        </span>
      </div>
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</span>
    </label>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DayProfileSettings() {
  const { dayProfiles, loadDayProfiles, saveDayProfile } = usePlanningStore();

  useEffect(() => {
    if (localStorage.getItem('token')) loadDayProfiles();
  }, [loadDayProfiles]);

  const profileOf = (dt: DayType) =>
    dayProfiles.find((p) => p.day_type === dt) ?? {
      id: '', workspace_id: '', day_type: dt, work_hours: 0, commute_hours: 0, free_hours: 3,
    };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111' }}>Capacity Settings</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
          Define how many free hours you have per day type. These drive the load bar in the Planning view
          and capacity warnings in the standup.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {(['workday', 'weekend', 'vacation'] as DayType[]).map((dt) => (
          <ProfileCard
            key={dt}
            dayType={dt}
            profile={profileOf(dt) as DayProfile}
            onSave={(form) => saveDayProfile(dt, form)}
          />
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>How the load bar works</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
          <li>Each task contributes <code>effort / duration_days</code> hours per day it spans.</li>
          <li>Green: planned load ≤ 80% of free hours &nbsp;·&nbsp; Yellow: 80–100% &nbsp;·&nbsp; Red: over 100%.</li>
          <li>Weekend days use the Weekend profile; all other days use Workday. Vacation days are set manually (coming soon).</li>
        </ul>
      </div>
    </div>
  );
}
