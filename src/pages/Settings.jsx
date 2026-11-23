import { useState, useEffect } from 'react';
import { settingsService } from '../services/problemService';
import { csFundamentalsService } from '../services/csFundamentalsService';

import { LoadingState, ErrorState } from '../components/States';
import { Card, CardHeader, CardBody } from '../components/Card';
import { Input, Button } from '../components/FormControls';
import { Sliders, Calendar, Target, CheckCircle2, Flame } from 'lucide-react';

function SaveBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium">
      <CheckCircle2 size={16} /> Revision intervals & settings saved
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // CS Learning Goals (loaded separately, saved separately)
  const [csSettings, setCsSettings] = useState({
    cs_daily_checklist_goal: 3,
    cs_learning_timezone: null,
  });
  const [csSaving, setCsSaving] = useState(false);
  const [csSaved, setCsSaved] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      settingsService.get(),
      csFundamentalsService.getCsSettings().catch(() => null),
    ])
      .then(([s, cs]) => {
        setSettings(s);
        if (cs) {
          setCsSettings({
            cs_daily_checklist_goal: cs.cs_daily_checklist_goal ?? 3,
            cs_learning_timezone: cs.cs_learning_timezone ?? null,
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const setNested = (section, field, value) => {
    setSettings((s) => ({
      ...s,
      [section]: { ...s[section], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCsSave = async () => {
    setCsSaving(true);
    try {
      await csFundamentalsService.updateCsSettings({
        cs_daily_checklist_goal: Number(csSettings.cs_daily_checklist_goal),
        cs_learning_timezone: csSettings.cs_learning_timezone || null,
      });
      setCsSaved(true);
      setTimeout(() => setCsSaved(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to save CS settings.');
    } finally {
      setCsSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  const stageDescriptions = [
    'Stage 1 (Initial recall — after first solve)',
    'Stage 2 (Short-term reinforcement)',
    'Stage 3 (Medium-term consolidation)',
    'Stage 4 (Longer retention verification)',
    'Stage 5 (Long-term mastery)',
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Customize your spaced-repetition intervals and daily practice goals</p>
      </div>

      {/* ── Spaced-Repetition Intervals ────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Sliders size={18} className="text-indigo-600" />
              Spaced-Repetition Intervals
            </span>
          }
          subtitle="Customize the number of days between revision stages"
        />
        <CardBody>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((stageNum, index) => {
              const fieldKey = `stage${stageNum}`;
              return (
                <div key={stageNum} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 gap-3">
                  <div>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md mr-2">
                      Interval {stageNum}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {stageDescriptions[index]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={settings.revisionIntervals[fieldKey]}
                      onChange={(e) => setNested('revisionIntervals', fieldKey, Math.max(1, Number(e.target.value)))}
                      className="w-20 px-3 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-center text-gray-900"
                    />
                    <span className="text-xs font-medium text-gray-500">days</span>
                  </div>
                </div>
              );
            })}

            {/* Periodic Interval Policy */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 gap-3 mt-4">
              <div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md mr-2">
                  Periodic Policy
                </span>
                <span className="text-sm font-medium text-gray-900">
                  Periodic review interval after reaching Stage 5 mastery
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={settings.periodicInterval}
                  onChange={(e) => setSettings((s) => ({ ...s, periodicInterval: Math.max(1, Number(e.target.value)) }))}
                  className="w-20 px-3 py-1.5 text-sm font-bold bg-white border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 text-center text-gray-900"
                />
                <span className="text-xs font-medium text-indigo-700">days</span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 leading-relaxed">
            <strong>How scheduling behaves:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
              <li><strong>Solved independently:</strong> Advances to the next interval stage.</li>
              <li><strong>Solved with a hint:</strong> Uses a shorter interval (steps back 1 stage).</li>
              <li><strong>Reviewed the solution / Unable to solve:</strong> Resets to Stage 1 for early retry.</li>
              <li><strong>Beyond Stage 5:</strong> Keeps periodic revision active every {settings.periodicInterval} days.</li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {/* ── Daily & Weekly Practice Targets ─────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Target size={18} className="text-emerald-600" />
              Practice Targets & Timezone
            </span>
          }
          subtitle="Set goals and timezone to keep your daily streak calculations consistent"
        />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Input
              label="Problems / Day"
              type="number"
              min="1"
              max="50"
              value={settings.goals.dailyProblems}
              onChange={(e) => setNested('goals', 'dailyProblems', Math.max(1, Number(e.target.value)))}
            />
            <Input
              label="Revisions / Day"
              type="number"
              min="1"
              max="50"
              value={settings.goals.dailyRevisions ?? 2}
              onChange={(e) => setNested('goals', 'dailyRevisions', Math.max(1, Number(e.target.value)))}
            />
            <Input
              label="Weekly Problem Goal"
              type="number"
              min="1"
              max="100"
              value={settings.goals.weeklyProblems}
              onChange={(e) => setNested('goals', 'weeklyProblems', Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Timezone (Evaluates daily streaks and calendar date boundaries)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.timezone || ''}
                onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                placeholder="e.g. UTC or Asia/Kolkata or America/New_York"
                className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-gray-900"
              />
              <button
                type="button"
                onClick={() => {
                  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  setSettings((s) => ({ ...s, timezone: detected }));
                }}
                className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors shrink-0"
              >
                Auto-Detect
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Currently evaluated as: <span className="font-mono font-medium text-gray-700">{settings.timezone || 'UTC'}</span>
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ── CS Learning Goals ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Flame size={18} className="text-orange-500" />
              CS Learning Goals
            </span>
          }
          subtitle="Configure daily goals and timezone for the CS Fundamentals learning streak"
        />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-orange-50/50 rounded-xl border border-orange-100 gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Daily Checklist Goal</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Number of checklist items to check per day to meet your daily CS goal
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={csSettings.cs_daily_checklist_goal}
                  onChange={(e) =>
                    setCsSettings((s) => ({
                      ...s,
                      cs_daily_checklist_goal: Math.max(1, Math.min(50, Number(e.target.value))),
                    }))
                  }
                  className="w-20 px-3 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-center text-gray-900"
                />
                <span className="text-xs font-medium text-gray-500">items</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                CS Learning Timezone (overrides global timezone for CS streak only)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={csSettings.cs_learning_timezone || ''}
                  onChange={(e) =>
                    setCsSettings((s) => ({ ...s, cs_learning_timezone: e.target.value || null }))
                  }
                  placeholder="Leave blank to use global timezone (default: Asia/Kolkata)"
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    setCsSettings((s) => ({ ...s, cs_learning_timezone: detected }));
                  }}
                  className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors shrink-0"
                >
                  Auto-Detect
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Effective timezone:{' '}
                <span className="font-mono font-medium text-gray-700">
                  {csSettings.cs_learning_timezone || settings?.timezone || 'Asia/Kolkata'}
                </span>
                {' '}· CS streak is tracked independently from your DSA practice streak.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {csSaved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={13} /> CS goals saved
              </span>
            )}
            <div className="ml-auto">
              <Button onClick={handleCsSave} loading={csSaving}>
                Save CS Goals
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Save Button (DSA settings) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} size="lg">
          Save DSA Settings
        </Button>
      </div>

      <SaveBanner visible={saved} />
    </div>
  );
}
