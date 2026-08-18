'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import TopAppBar from '@/components/layout/TopAppBar';
import { getClassrooms, createClassroom, deleteClassroom } from '@/lib/firebase/classrooms.service';
import { Classroom } from '@/types';
import { getCurrentPosition } from '@/lib/utils/gps.utils';
import dynamic from 'next/dynamic';

const ClassroomMap = dynamic(() => import('@/components/map/ClassroomMap'), { 
  ssr: false,
  loading: () => <div className="h-64 w-full bg-surface-container-low animate-pulse rounded-2xl flex items-center justify-center text-on-surface-variant text-sm">Loading Map...</div>
});

export default function ClassroomsPage() {
  const { user } = useAuthStore();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: '100' });
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    try { setClassrooms(await getClassrooms()); }
    catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-fetch location when modal opens if we don't have one yet
  useEffect(() => {
    if (showModal && !form.latitude) {
      handleGetLocation();
    }
  }, [showModal]);

  async function handleGetLocation() {
    setGettingLocation(true);
    try {
      const pos = await getCurrentPosition();
      setForm(f => ({ ...f, latitude: pos.latitude.toFixed(6), longitude: pos.longitude.toFixed(6) }));
    } catch (e: any) {
      setError(e.message);
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
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteClassroom(id);
    await load();
  };

  return (
    <div className="bg-background">
      <TopAppBar title="Classrooms" />
      <main className="px-5 pt-6 max-w-lg mx-auto pb-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-on-surface-variant">{classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1 bg-primary-container text-on-primary-container text-xs font-semibold px-4 h-10 rounded-full active:scale-95">
            <span className="material-symbols-outlined text-lg">add</span>
            Add Classroom
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : classrooms.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center card-shadow">
            <span className="material-symbols-outlined text-outline text-5xl mb-3 block">location_on</span>
            <p className="text-base font-semibold text-on-surface">No classrooms yet</p>
            <p className="text-sm text-on-surface-variant mt-1 mb-4">Add classrooms to enable GPS verification for attendance</p>
            <button onClick={() => setShowModal(true)}
              className="bg-primary-container text-on-primary-container text-sm font-semibold px-6 h-10 rounded-full active:scale-95">
              Add First Classroom
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {classrooms.map(room => (
              <div key={room.classroomId} className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20">
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
          className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
          onClick={() => { setShowModal(false); setError(''); }}
        >
          <div 
            className="bg-surface-container-lowest rounded-t-3xl w-full max-w-lg flex flex-col"
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
                  <label className="text-xs font-semibold text-on-surface-variant">Classroom Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. Lecture Hall 1"
                    className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="w-full h-12 border border-primary text-primary rounded-lg text-sm font-semibold active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg">my_location</span>
                  {gettingLocation ? 'Getting location...' : 'Find My Location'}
                </button>
                
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
    </div>
  );
}
