'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import TopAppBar from '@/components/layout/TopAppBar';
import { getClassrooms, createClassroom, deleteClassroom } from '@/lib/firebase/classrooms.service';
import { Classroom } from '@/types';
import EmptyState from '@/components/ui/EmptyState';
import AppDialog from '@/components/ui/AppDialog';
import { averagePosition, suggestRadius } from '@/lib/utils/gps.utils';
import dynamic from 'next/dynamic';
import ErrorBanner, { errorMessage } from '@/components/ui/ErrorBanner';
import { useToast } from '@/components/ui/Toast';
import { SkeletonCards } from '@/components/ui/Skeleton';

const ClassroomMap = dynamic(() => import('@/components/map/ClassroomMap'), { 
  ssr: false,
  loading: () => <div className="h-64 w-full bg-surface-container-low animate-pulse rounded-2xl flex items-center justify-center text-on-surface-variant text-sm">Loading Map...</div>
});

export default function ClassroomsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationInfo, setLocationInfo] = useState('');
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: '100' });
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError('');
    try { setClassrooms(await getClassrooms()); }
    catch (e) { setLoadError(errorMessage(e, 'Could not load classrooms.')); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-fetch location when modal opens if we don't have one yet
  useEffect(() => {
    if (showModal && !form.latitude) {
      handleGetLocation();
    }
  }, [showModal]);

  // Average ~12 s of readings while the lecturer stands in the room, then suggest a radius
  // that covers the GPS error students will see there.
  async function handleGetLocation() {
    setGettingLocation(true);
    setError('');
    setLocationInfo('Measuring your location — stay where you are...');
    try {
      const pos = await averagePosition({
        durationMs: 12000,
        onUpdate: cur => setLocationInfo(`Measuring... ${cur.samples} reading${cur.samples === 1 ? '' : 's'}, ±${Math.round(cur.accuracy)}m`),
      });
      const radius = suggestRadius(pos.accuracy);
      setForm(f => ({ ...f, latitude: pos.latitude.toFixed(6), longitude: pos.longitude.toFixed(6), radius: radius.toString() }));
      setLocationInfo(
        `Pin placed from ${pos.samples} reading${pos.samples === 1 ? '' : 's'} (±${Math.round(pos.accuracy)}m). ` +
        `Radius set to ${radius}m — drag the slider to adjust.` +
        (pos.accuracy > 40 ? ' Accuracy is low indoors; move near a window and measure again for a tighter pin.' : ''),
      );
    } catch (e: any) {
      setError(e.message);
      setLocationInfo('');
    } finally { setGettingLocation(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Classroom name is required'); return; }
    if (!form.latitude || !form.longitude) { setError('Location is required'); return; }
    setCreating(true); setError('');
    try {
      await createClassroom({
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius: parseInt(form.radius) || 100,
      });
      setShowModal(false);
      setForm({ name: '', latitude: '', longitude: '', radius: '100' });
      setLocationInfo('');
      toast.success('Classroom added.');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteClassroom(deleteTarget.id);
    toast.success(`Deleted ${deleteTarget.name}.`);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div className="bg-background">
      <TopAppBar title="Classrooms" />
      <main className="px-4 sm:px-6 pt-6 max-w-5xl mx-auto pb-8">
        {loadError && <div className="mb-4"><ErrorBanner message={loadError} onDismiss={() => setLoadError('')} /></div>}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-on-surface-variant">{classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1 bg-primary-container text-on-primary-container text-xs font-semibold px-4 h-10 rounded-full active:scale-95">
            <span className="material-symbols-outlined text-lg">add</span>
            Add Classroom
          </button>
        </div>

        {isLoading ? (
          <SkeletonCards count={3} className="h-24" />
        ) : classrooms.length === 0 ? (
          <EmptyState
            icon="location_on"
            title="No classrooms yet"
            description="Add classrooms to enable GPS verification for attendance."
            action={
              <button onClick={() => setShowModal(true)}
                className="bg-primary-container text-on-primary-container text-sm font-bold px-6 h-12 rounded-full active:scale-95 transition-all">
                Add First Classroom
              </button>
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classrooms.map(room => (
              <div key={room.classroomId} className="bg-surface-container-lowest rounded-2xl p-4 shadow-card border border-outline-variant/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary" style={{fontVariationSettings:"'FILL' 1"}}>location_on</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-on-surface">{room.name}</h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {room.latitude.toFixed(4)}, {room.longitude.toFixed(4)} • {room.radius}m radius
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(room.classroomId, room.name)}
                    className="w-9 h-9 rounded-full hover:bg-error-container/30 flex items-center justify-center text-error active:scale-95">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center sm:p-6"
          onClick={() => { setShowModal(false); setError(''); }}
        >
          <div 
            className="bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl w-full max-w-lg flex flex-col shadow-raised animate-fade-up"
            style={{maxHeight: '90vh'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1 bg-outline-variant rounded-full" />
            </div>
            <div className="overflow-y-auto px-6 pb-24">
              <h2 className="text-xl font-bold text-on-surface mb-5">Add Classroom</h2>
              {error && (
                <div className="mb-4 p-3 bg-error-container rounded-lg text-sm text-on-error-container">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="field-label">Classroom Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. Lecture Hall 1"
                    className="field-input"
                  />
                </div>
                <button
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="w-full h-12 border border-primary text-primary rounded-lg text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg">my_location</span>
                  {gettingLocation ? 'Measuring location...' : 'Use My Current Location'}
                </button>
                {locationInfo && (
                  <p className="text-xs text-on-surface-variant -mt-2" aria-live="polite">{locationInfo}</p>
                )}
                
                <ClassroomMap 
                  center={{ lat: parseFloat(form.latitude) || 0, lng: parseFloat(form.longitude) || 0 }}
                  radius={parseInt(form.radius) || 100}
                  onLocationChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
                  onRadiusChange={(radius) => setForm(f => ({ ...f, radius: radius.toString() }))}
                />
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => { setShowModal(false); setError(''); }}
                    className="flex-1 h-12 border border-outline-variant rounded-full text-sm text-on-surface-variant active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 h-12 bg-primary-container text-on-primary-container rounded-full text-sm font-semibold disabled:opacity-60 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : 'Add Classroom'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Classroom Dialog */}
      <AppDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        icon="delete"
        variant="destructive"
        title={`Delete "${deleteTarget?.name}"?`}
        description="This classroom will be permanently removed. Any sessions using it will not be affected."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
