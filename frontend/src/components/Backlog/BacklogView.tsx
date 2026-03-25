/**
 * BacklogView — BL-45, BL-46, BL-47 + bucket-level sharing
 *
 * BL-45: A dedicated backlog view where items can be added freely
 * BL-46: "Activate as task" opens the normal TaskDetailPanel in create mode
 * BL-47: Items are grouped by named buckets; uncategorised items live in "Inbox"
 * Sharing: each bucket can be shared individually with specific people
 */

import { useEffect, useState } from 'react';
import { useBacklogStore } from '../../store/backlogStore';
import { usePlanningStore } from '../../store/planningStore';
import type { BacklogItem, BacklogBucket, BucketShareSummary, SharedBacklog, TaskCategory } from '../../types';
import { TaskDetailPanel } from '../PlanningView/TaskDetailPanel';
import type { NewTaskData, TaskOptionGroup } from '../PlanningView/TaskDetailPanel';

// ─── helpers ──────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<TaskCategory, { bg: string; text: string; border: string }> = {
  work:     { bg: '#eff6ff', text: '#1d6fa4', border: '#bfdbfe' },
  personal: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
};

// ─── item modal ───────────────────────────────────────────────────────────────

interface ItemModalProps {
  buckets:          BacklogBucket[];
  item?:            BacklogItem;
  defaultBucketId?: string | null;
  onSave: (data: { title: string; description?: string; category: TaskCategory; effort?: number | null; bucket_id?: string | null }) => void;
  onClose: () => void;
}

function ItemModal({ buckets, item, defaultBucketId, onSave, onClose }: ItemModalProps) {
  const isEdit = !!item;
  const [title,       setTitle]       = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category,    setCategory]    = useState<TaskCategory>(item?.category ?? 'personal');
  const [effort,      setEffort]      = useState(item?.effort != null ? String(item.effort) : '');
  const [bucketId,    setBucketId]    = useState<string>(item?.bucket_id ?? defaultBucketId ?? '');

  const canSave = title.trim().length > 0;
  const submit = () => {
    if (!canSave) return;
    onSave({ title: title.trim(), description: description.trim() || undefined, category, effort: effort ? parseFloat(effort) : null, bucket_id: bucketId || null });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1000, width: 420, background: 'white', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', borderRadius: '10px 10px 0 0' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, background: isEdit ? '#e8f4ff' : '#dcfce7', color: isEdit ? '#1d6fa4' : '#166534', padding: '2px 6px', borderRadius: 4 }}>{isEdit ? 'EDIT' : 'NEW'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#222', flex: 1 }}>{isEdit ? 'Edit backlog item' : 'Add to backlog'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            Title
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="What do you want to get done?" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Description <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Any notes…" style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</div>
            <div style={{ display: 'flex', borderRadius: 6, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              {(['work', 'personal'] as TaskCategory[]).map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)} style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: category === cat ? (cat === 'work' ? '#1d6fa4' : '#7c3aed') : 'white', color: category === cat ? 'white' : '#888', transition: 'all 0.15s' }}>
                  {cat === 'work' ? '💼 Work' : '🌿 Personal'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Effort (hrs) <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span>
              <input type="number" min={0.25} step={0.25} value={effort} onChange={(e) => setEffort(e.target.value)} placeholder="e.g. 4" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Bucket
              <select value={bucketId} onChange={(e) => setBucketId(e.target.value)} style={inputStyle}>
                <option value="">— Inbox —</option>
                {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 8, background: '#fafafa', borderRadius: '0 0 10px 10px' }}>
          <button onClick={submit} disabled={!canSave} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: canSave ? '#4a9eff' : '#d0e8ff', color: canSave ? 'white' : '#8ab8e0', fontWeight: 600, fontSize: 13, cursor: canSave ? 'pointer' : 'default' }}>
            {isEdit ? 'Save' : 'Add to backlog'}
          </button>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#555', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── bucket modal ─────────────────────────────────────────────────────────────

function BucketModal({ existing, onSave, onClose }: { existing?: BacklogBucket; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1000, width: 340, background: 'white', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: 20, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{existing ? 'Rename bucket' : 'New bucket'}</div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }} placeholder="e.g. Renovation project" style={inputStyle} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: name.trim() ? '#4a9eff' : '#d0e8ff', color: name.trim() ? 'white' : '#8ab8e0', fontWeight: 600, fontSize: 13, cursor: name.trim() ? 'pointer' : 'default' }}>
            {existing ? 'Save' : 'Create'}
          </button>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#555', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── bucket share modal ───────────────────────────────────────────────────────

interface BucketShareModalProps {
  bucket:   BacklogBucket;
  onInvite: (bucketId: string, email: string) => Promise<void>;
  onRevoke: (shareId: string, bucketId: string) => Promise<void>;
  onClose:  () => void;
}

function BucketShareModal({ bucket, onInvite, onRevoke, onClose }: BucketShareModalProps) {
  const [email,  setEmail]  = useState('');
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const submit = async () => {
    if (!email.trim()) return;
    setSaving(true); setErrMsg('');
    try {
      await onInvite(bucket.id, email.trim().toLowerCase());
      setEmail('');
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to invite');
    } finally {
      setSaving(false);
    }
  };

  const shares = bucket.shares ?? [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1000, width: 400, background: 'white', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', borderRadius: '10px 10px 0 0' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#222', flex: 1 }}>🔗 Share bucket: {bucket.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Current shares */}
          {shares.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Shared with</div>
              {shares.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#333' }}>{s.invitee_email}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                    background: s.status === 'accepted' ? '#dcfce7' : s.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                    color:      s.status === 'accepted' ? '#166534' : s.status === 'rejected' ? '#991b1b' : '#854d0e',
                  }}>{s.status.toUpperCase()}</span>
                  <button onClick={() => onRevoke(s.id, bucket.id)} style={{ ...iconBtn, color: '#dc2626', fontSize: 13 }} title="Revoke">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Invite new */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Invite someone</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email" autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="someone@example.com"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={submit} disabled={saving || !email.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: email.trim() && !saving ? '#4a9eff' : '#d0e8ff', color: email.trim() && !saving ? 'white' : '#8ab8e0', fontWeight: 600, fontSize: 13, cursor: email.trim() && !saving ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                {saving ? '…' : 'Invite'}
              </button>
            </div>
            {errMsg && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errMsg}</div>}
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
              They'll see a notification next time they log in.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── pending invite popup ─────────────────────────────────────────────────────

export function PendingInvitePopup({ invites, onRespond }: { invites: import('../../types').BacklogShare[]; onRespond: (id: string, accept: boolean) => Promise<void> }) {
  const [idx, setIdx] = useState(0);
  const invite = invites[idx];
  if (!invite) return null;

  const handle = async (accept: boolean) => {
    await onRespond(invite.id, accept);
    if (idx >= invites.length - 1) setIdx(0);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999, width: 400, background: 'white', borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', background: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔗</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Backlog deling — invitation</span>
          {invites.length > 1 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888', background: '#2a2a3e', padding: '2px 8px', borderRadius: 10 }}>{idx + 1} / {invites.length}</span>
          )}
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
            {invite.owner_email} vil gerne dele en bucket med dig
          </div>
          <div style={{ fontSize: 13, color: '#444', marginBottom: 4 }}>
            Bucket: <strong>🗂 {invite.bucket_name}</strong>
          </div>
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
            Accepterer du, kan du se og bidrage til denne bucket — og aktivere items som tasks på dit eget Gantt.
          </div>
        </div>
        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10 }}>
          <button onClick={() => handle(true)}  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>✓ Ja, accepter</button>
          <button onClick={() => handle(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e0e0e0', background: 'white', color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Nej tak</button>
        </div>
      </div>
    </>
  );
}

// ─── shared bucket section ────────────────────────────────────────────────────

function SharedBucketSection({ shared, onActivate, onAddItem }: {
  shared:    SharedBacklog;
  onActivate: (item: BacklogItem, bucketId: string) => void;
  onAddItem:  (bucketId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { share, items } = shared;

  return (
    <div style={{ background: 'white', borderRadius: 10, border: '2px solid #d1fae5', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', padding: 0 }}>
          {collapsed ? '▶' : '▼'}
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#166534', flex: 1 }}>
          🗂 {share.bucket_name}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>fra {share.owner_email}</span>
        <span style={{ fontSize: 11, color: '#aaa', background: '#f0f0f0', borderRadius: 10, padding: '1px 7px' }}>{items.length}</span>
        <button onClick={() => onAddItem(share.bucket_id)} style={{ ...ghostBtn, fontSize: 11, padding: '3px 8px', borderColor: '#16a34a', color: '#16a34a' }}>+ Add</button>
      </div>
      {!collapsed && (
        <div>
          {items.length === 0
            ? <div style={{ padding: '14px', fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No items yet</div>
            : items.map((item) => (
                <SharedItemRow key={item.id} item={item} onActivate={() => onActivate(item, share.bucket_id)} />
              ))
          }
        </div>
      )}
    </div>
  );
}

function SharedItemRow({ item, onActivate }: { item: BacklogItem; onActivate: () => void }) {
  const col = CAT_COLORS[item.category];
  return (
    <div
      style={{ padding: '10px 14px', borderTop: '1px solid #f0fdf4', display: 'flex', alignItems: 'flex-start', gap: 10 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2, background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
        {item.category === 'work' ? 'WORK' : 'PERSONAL'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#222', wordBreak: 'break-word' }}>{item.title}</div>
        {item.description && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.description}</div>}
      </div>
      {item.effort != null && (
        <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>{item.effort}h</span>
      )}
      <button onClick={onActivate} title="Take this item and activate as task" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #16a34a', background: 'white', color: '#16a34a', cursor: 'pointer', fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
        → Take
      </button>
    </div>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────

export function BacklogView() {
  const {
    items, buckets, sharedBacklogs,
    loading, error,
    fetchAll, createItem, updateItem, deleteItem,
    createBucket, updateBucket, deleteBucket,
    invite, revokeShare,
    createSharedItem, activateSharedItem,
  } = useBacklogStore();
  const { projects, phases, tasks, createTask } = usePlanningStore();

  const [showItemModal,   setShowItemModal]   = useState<{ open: boolean; item?: BacklogItem; defaultBucketId?: string | null; sharedBucketId?: string }>({ open: false });
  const [showBucketModal, setShowBucketModal] = useState<{ open: boolean; bucket?: BacklogBucket }>({ open: false });
  const [shareModal,      setShareModal]      = useState<BacklogBucket | null>(null);
  const [activating,      setActivating]      = useState<BacklogItem | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const taskOptionGroups: TaskOptionGroup[] = projects.flatMap((proj) => {
    const projPhases = phases[proj.id] ?? [];
    return projPhases.map((ph) => ({
      groupLabel: `${proj.title} / ${ph.title}`,
      options: (tasks[ph.id] ?? []).map((t) => ({ id: t.id, label: t.title })),
    })).filter((g) => g.options.length > 0);
  });

  const allPhases = Object.values(phases).flat();
  const inbox     = items.filter((i) => !i.bucket_id);
  const grouped   = buckets.map((b) => ({ bucket: b, items: items.filter((i) => i.bucket_id === b.id) }));

  const handleSaveItem = async (data: Parameters<typeof createItem>[0]) => {
    if (showItemModal.sharedBucketId) {
      await createSharedItem(showItemModal.sharedBucketId, data);
    } else if (showItemModal.item) {
      await updateItem(showItemModal.item.id, data as Partial<BacklogItem>);
    } else {
      await createItem({ ...data, bucket_id: data.bucket_id ?? showItemModal.defaultBucketId ?? null });
    }
    setShowItemModal({ open: false });
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Remove this backlog item?')) return;
    await deleteItem(id);
  };

  const handleSaveBucket = async (name: string) => {
    if (showBucketModal.bucket) await updateBucket(showBucketModal.bucket.id, name);
    else await createBucket(name);
    setShowBucketModal({ open: false });
  };

  const handleDeleteBucket = async (id: string) => {
    if (!window.confirm('Delete this bucket? Items will move to Inbox.')) return;
    await deleteBucket(id);
  };

  const handleActivate = async (data: NewTaskData) => {
    await createTask(data);
    if (activating) await deleteItem(activating.id);
    setActivating(null);
  };

  const handleActivateShared = async (item: BacklogItem, bucketId: string) => {
    const prefillItem = await activateSharedItem(item.id, bucketId);
    setActivating(prefillItem);
  };

  if (loading) return <div style={{ padding: 40, color: '#888', fontFamily: 'system-ui' }}>Loading backlog…</div>;
  if (error)   return <div style={{ padding: 40, color: '#dc2626', fontFamily: 'system-ui' }}>Error: {error}</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>

      {/* Toolbar */}
      <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Backlog</span>
        <span style={{ fontSize: 12, color: '#888', background: '#f0f0f0', borderRadius: 10, padding: '2px 8px' }}>{items.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowBucketModal({ open: true })} style={ghostBtn}>+ New bucket</button>
        <button onClick={() => setShowItemModal({ open: true })} style={primaryBtn}>+ Add item</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {items.length === 0 && sharedBacklogs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#888' }}>Your backlog is empty</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Add things you want to do eventually — no dates required.</div>
          </div>
        )}

        {/* Own buckets (BL-47) */}
        {grouped.map(({ bucket, items: bItems }) => (
          <BucketSection key={bucket.id} bucket={bucket} items={bItems}
            onAddItem={() => setShowItemModal({ open: true, defaultBucketId: bucket.id })}
            onEditItem={(item) => setShowItemModal({ open: true, item })}
            onDeleteItem={handleDeleteItem}
            onActivate={setActivating}
            onRenameBucket={() => setShowBucketModal({ open: true, bucket })}
            onDeleteBucket={() => handleDeleteBucket(bucket.id)}
            onShareBucket={() => setShareModal(bucket)}
          />
        ))}

        {/* Inbox */}
        {(inbox.length > 0 || (buckets.length === 0 && sharedBacklogs.length === 0)) && (
          <BucketSection bucket={null} items={inbox}
            onAddItem={() => setShowItemModal({ open: true, defaultBucketId: null })}
            onEditItem={(item) => setShowItemModal({ open: true, item })}
            onDeleteItem={handleDeleteItem}
            onActivate={setActivating}
          />
        )}

        {/* Shared buckets from others */}
        {sharedBacklogs.map((sb) => (
          <SharedBucketSection
            key={sb.share.id}
            shared={sb}
            onActivate={handleActivateShared}
            onAddItem={(bucketId) => setShowItemModal({ open: true, sharedBucketId: bucketId })}
          />
        ))}
      </div>

      {/* Modals */}
      {showItemModal.open && (
        <ItemModal
          buckets={buckets}
          item={showItemModal.item}
          defaultBucketId={showItemModal.defaultBucketId}
          onSave={handleSaveItem}
          onClose={() => setShowItemModal({ open: false })}
        />
      )}
      {showBucketModal.open && (
        <BucketModal existing={showBucketModal.bucket} onSave={handleSaveBucket} onClose={() => setShowBucketModal({ open: false })} />
      )}
      {shareModal && (
        <BucketShareModal
          bucket={shareModal}
          onInvite={invite}
          onRevoke={revokeShare}
          onClose={() => setShareModal(null)}
        />
      )}

      {/* BL-46: TaskDetailPanel for activating a backlog item as a real task */}
      {activating && (
        <TaskDetailPanel
          mode="create"
          phases={allPhases}
          taskOptionGroups={taskOptionGroups}
          onCreate={handleActivate}
          onClose={() => setActivating(null)}
          prefill={{ title: activating.title, category: activating.category, effort: activating.effort ?? 1 }}
        />
      )}
    </div>
  );
}

// ─── bucket section ───────────────────────────────────────────────────────────

interface BucketSectionProps {
  bucket:          BacklogBucket | null;
  items:           BacklogItem[];
  onAddItem:       () => void;
  onEditItem:      (item: BacklogItem) => void;
  onDeleteItem:    (id: string) => void;
  onActivate:      (item: BacklogItem) => void;
  onRenameBucket?: () => void;
  onDeleteBucket?: () => void;
  onShareBucket?:  () => void;
}

function BucketSection({ bucket, items, onAddItem, onEditItem, onDeleteItem, onActivate, onRenameBucket, onDeleteBucket, onShareBucket }: BucketSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const shareCount = bucket?.shares?.filter((s) => s.status === 'accepted').length ?? 0;

  return (
    <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: bucket ? '#f0f7ff' : '#fafafa', borderBottom: collapsed ? 'none' : '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#666', padding: 0, lineHeight: 1 }}>
          {collapsed ? '▶' : '▼'}
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: bucket ? '#1d6fa4' : '#888', flex: 1 }}>
          {bucket ? `🗂 ${bucket.name}` : '📥 Inbox'}
        </span>
        <span style={{ fontSize: 11, color: '#aaa', background: '#f0f0f0', borderRadius: 10, padding: '1px 7px' }}>{items.length}</span>
        {bucket && (
          <>
            {/* Share indicator */}
            {shareCount > 0 && (
              <span title={`Shared with ${shareCount} person(s)`} style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                🔗 {shareCount}
              </span>
            )}
            <button onClick={onShareBucket} style={{ ...iconBtn, fontSize: 13 }} title="Share bucket">🔗</button>
            <button onClick={onRenameBucket} style={iconBtn} title="Rename">✏️</button>
            <button onClick={onDeleteBucket} style={iconBtn} title="Delete bucket">🗑</button>
          </>
        )}
        <button onClick={onAddItem} style={{ ...ghostBtn, fontSize: 11, padding: '3px 8px' }}>+ Add</button>
      </div>
      {!collapsed && (
        <div>
          {items.length === 0
            ? <div style={{ padding: '14px', fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No items yet</div>
            : items.map((item) => (
                <ItemRow key={item.id} item={item}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => onDeleteItem(item.id)}
                  onActivate={() => onActivate(item)}
                />
              ))
          }
        </div>
      )}
    </div>
  );
}

// ─── item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, onEdit, onDelete, onActivate }: { item: BacklogItem; onEdit: () => void; onDelete: () => void; onActivate: () => void }) {
  const col = CAT_COLORS[item.category];
  return (
    <div
      style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'flex-start', gap: 10 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafcff')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginTop: 2, background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
        {item.category === 'work' ? 'WORK' : 'PERSONAL'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#222', wordBreak: 'break-word' }}>{item.title}</div>
        {item.description && <div style={{ fontSize: 11, color: '#888', marginTop: 2, wordBreak: 'break-word' }}>{item.description}</div>}
      </div>
      {item.effort != null && (
        <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 2 }}>{item.effort}h</span>
      )}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 1 }}>
        <button onClick={onActivate} title="Activate as task" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #4a9eff', background: 'white', color: '#4a9eff', cursor: 'pointer', fontWeight: 600 }}>
          → Task
        </button>
        <button onClick={onEdit}   style={iconBtn} title="Edit">✏️</button>
        <button onClick={onDelete} style={iconBtn} title="Remove">🗑</button>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#555' };
const inputStyle: React.CSSProperties  = { padding: '6px 8px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13, color: '#222', outline: 'none', width: '100%', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties  = { background: '#4a9eff', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const ghostBtn: React.CSSProperties    = { background: 'white', color: '#4a9eff', border: '1px solid #4a9eff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const iconBtn: React.CSSProperties     = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, lineHeight: 1 };

// Re-export for App.tsx
export type { BucketShareSummary };
