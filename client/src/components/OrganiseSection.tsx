import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiDelete, apiGet, apiPost, apiPut, resolveAssetUrl } from '../api';
import { OrganiseItem, VehicleService } from '../types';

export const OrganiseSection: React.FC = () => {
  const { showToast } = useApp();
  const [items, setItems] = useState<OrganiseItem[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'cars' | 'bills'>('all');

  // Add item modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addCategory, setAddCategory] = useState('car');
  const [addTitle, setAddTitle] = useState('');
  const [addProvider, setAddProvider] = useState('');
  const [addDueDate, setAddDueDate] = useState('');
  const [addCost, setAddCost] = useState('');
  const [addMake, setAddMake] = useState('');
  const [addModel, setAddModel] = useState('');
  const [addYear, setAddYear] = useState('');
  const [addRego, setAddRego] = useState('');
  const [addOdometer, setAddOdometer] = useState('');

  // Service history modal state
  const [activeVehicle, setActiveVehicle] = useState<OrganiseItem | null>(null);
  const [services, setServices] = useState<VehicleService[]>([]);
  const [srvType, setSrvType] = useState('Logbook Service');
  const [srvDate, setSrvDate] = useState('');
  const [srvMileage, setSrvMileage] = useState('');
  const [srvNextDate, setSrvNextDate] = useState('');
  const [srvNextMileage, setSrvNextMileage] = useState('');
  const [srvCost, setSrvCost] = useState('');
  const [srvProvider, setSrvProvider] = useState('');
  const [srvNotes, setSrvNotes] = useState('');

  const loadItems = useCallback(async () => {
    try {
      const res = await apiGet<{ success: boolean; items: OrganiseItem[] }>('organise/items');
      if (res?.items) setItems(res.items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) return;
    try {
      await apiPost('organise/items', {
        category: addCategory,
        title: addTitle.trim(),
        provider: addProvider.trim() || null,
        due_date: addDueDate || null,
        cost: addCost ? parseFloat(addCost) : null,
        vehicle_make: addMake.trim() || null,
        vehicle_model: addModel.trim() || null,
        vehicle_year: addYear ? parseInt(addYear, 10) : null,
        vehicle_rego: addRego.trim() || null,
        current_odometer: addOdometer ? parseInt(addOdometer, 10) : null,
      });
      setShowAddModal(false);
      setAddTitle('');
      setAddProvider('');
      setAddDueDate('');
      setAddCost('');
      setAddMake('');
      setAddModel('');
      setAddYear('');
      setAddRego('');
      setAddOdometer('');
      showToast('Added item to Organise');
      await loadItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to add item', { type: 'error' });
    }
  };

  const handleRenewItem = async (item: OrganiseItem) => {
    try {
      await apiPost(`organise/items/${item.id}/renew`, { months: 12 });
      showToast(`Renewed "${item.title}" (+12 months)`);
      await loadItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to renew item', { type: 'error' });
    }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await apiDelete(`organise/items/${id}`);
      showToast('Removed item');
      await loadItems();
    } catch {
      // ignore
    }
  };

  const handleUpdateOdometer = async (car: OrganiseItem, newOdo: string) => {
    const num = parseInt(newOdo, 10);
    if (isNaN(num)) return;
    try {
      await apiPut(`organise/items/${car.id}`, { current_odometer: num });
      showToast(`Updated odometer for ${car.title}`);
      await loadItems();
    } catch {
      // ignore
    }
  };

  const handleUploadCarPhoto = async (car: OrganiseItem, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await apiPost(`organise/items/${car.id}/photo`, fd);
      showToast('Vehicle photo updated');
      await loadItems();
    } catch {
      // ignore
    }
  };

  const openServicesModal = async (car: OrganiseItem) => {
    setActiveVehicle(car);
    try {
      const res = await apiGet<{ success: boolean; services: VehicleService[] }>(
        `organise/items/${car.id}/services`
      );
      if (res?.services) setServices(res.services);
    } catch {
      setServices([]);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVehicle) return;
    try {
      await apiPost(`organise/items/${activeVehicle.id}/services`, {
        service_type: srvType,
        service_date: srvDate || new Date().toISOString().slice(0, 10),
        mileage: srvMileage ? parseInt(srvMileage, 10) : null,
        next_service_date: srvNextDate || null,
        next_service_mileage: srvNextMileage ? parseInt(srvNextMileage, 10) : null,
        cost: srvCost ? parseFloat(srvCost) : null,
        provider: srvProvider.trim() || null,
        notes: srvNotes.trim() || null,
      });
      setSrvMileage('');
      setSrvCost('');
      setSrvNotes('');
      showToast('Logged vehicle service');
      await openServicesModal(activeVehicle);
      await loadItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to log service', { type: 'error' });
    }
  };

  const handleDeleteService = async (sid: number) => {
    if (!activeVehicle) return;
    await apiDelete(`organise/services/${sid}`);
    await openServicesModal(activeVehicle);
  };

  const [collapsed, setCollapsed] = useState(true);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const cars = items.filter((i) => i.category === 'car');
  const bills = items.filter((i) => i.category !== 'car');

  return (
    <>
      <section className={`organise-section collapsible-section${collapsed ? ' collapsed' : ''} admin-only`} id="organise-section">
        <h2
          className="section-title section-toggle"
          onClick={() => setCollapsed((c) => !c)}
          style={{ cursor: 'pointer' }}
        >
          <i className="fas fa-folder-open" style={{ color: '#38bdf8' }} /> Organise
          <i className="fas fa-chevron-down section-chevron" />
        </h2>
        <div className="organise-body">
          <div className="organise-toolbar">
            <p className="org-subtitle">
              Keep cars, documents and service details in one place. Tap a widget to update kilometres, services or renewals.
            </p>
            <div className="org-toolbar-actions">
              {(['all', 'cars', 'bills'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTab(t)}
                  className="org-quick-btn"
                  style={{
                    background: filterTab === t ? 'rgba(59,130,246,0.25)' : undefined,
                    borderColor: filterTab === t ? '#3b82f6' : undefined,
                  }}
                >
                  {t === 'all' ? 'All' : t === 'cars' ? '🚗 Vehicles' : '📄 Bills & Renewals'}
                </button>
              ))}
              <button
                id="organise-add-btn"
                type="button"
                onClick={() => setShowAddModal(true)}
                className="org-add-btn admin-only"
              >
                <i className="fas fa-plus" /> Add
              </button>
              <div className="org-quick-wrap admin-only" style={{ position: 'relative' }}>
                <button
                  id="org-quick-btn"
                  className="org-quick-btn"
                  type="button"
                  onClick={() => setQuickMenuOpen((o) => !o)}
                >
                  <i className="fas fa-car" /> Templates
                </button>
                {quickMenuOpen && (
                  <div id="org-quick-menu" className="org-quick-menu" style={{ display: 'block' }}>
                    <div className="org-quick-heading">Car</div>
                    <button
                      type="button"
                      className="org-quick-item"
                      onClick={() => {
                        setAddCategory('car');
                        setAddTitle('');
                        setQuickMenuOpen(false);
                        setShowAddModal(true);
                      }}
                    >
                      🚗 Add a car
                    </button>
                    <div className="org-quick-heading">Attach to a car</div>
                    {[
                      { title: 'Registration / Rego', cat: 'rego', icon: '🔖' },
                      { title: 'CTP / Green Slip', cat: 'insurance', icon: '🛡️' },
                      { title: 'Comprehensive Insurance', cat: 'insurance', icon: '🛡️' },
                      { title: 'Roadside Assistance', cat: 'subscription', icon: '🚨' },
                    ].map((tmpl) => (
                      <button
                        key={tmpl.title}
                        type="button"
                        className="org-quick-item"
                        onClick={() => {
                          setAddCategory(tmpl.cat);
                          setAddTitle(tmpl.title);
                          setQuickMenuOpen(false);
                          setShowAddModal(true);
                        }}
                      >
                        {tmpl.icon} {tmpl.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div id="organise-items-container">
            {/* Vehicles Grid */}
            {(filterTab === 'all' || filterTab === 'cars') && cars.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
          {cars.map((car) => (
            <div key={car.id} className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
              {car.photo_url ? (
                <div style={{ height: 150, position: 'relative' }}>
                  <img
                    src={resolveAssetUrl(car.photo_url)}
                    alt={car.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ) : null}

              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem' }}>🚗 {car.title}</h3>
                    <div style={{ fontSize: '0.82rem', opacity: 0.75, marginTop: 2 }}>
                      {[car.vehicle_year, car.vehicle_make, car.vehicle_model].filter(Boolean).join(' ')}{' '}
                      {car.vehicle_rego && `• Rego: ${car.vehicle_rego}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(car.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>ODOMETER (KM)</div>
                    <input
                      type="number"
                      defaultValue={car.current_odometer ?? ''}
                      placeholder="e.g. 85000"
                      onBlur={(e) => handleUpdateOdometer(car, e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        fontWeight: 800,
                        fontSize: '1rem',
                        marginTop: 2,
                      }}
                    />
                  </div>
                  <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>NEXT SERVICE</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>
                      {car.next_service_date || 'Not set'}
                      {car.next_service_mileage ? ` (${car.next_service_mileage} km)` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openServicesModal(car)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(59,130,246,0.2)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59,130,246,0.4)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🔧 Service History
                  </button>

                  <label
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    📷 Photo
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadCarPhoto(car, f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bills & Renewals Grid */}
      {(filterTab === 'all' || filterTab === 'bills') && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {bills.map((b) => {
            const statusColor =
              b.status === 'overdue' ? '#ef4444' : b.status === 'due_soon' ? '#f59e0b' : '#22c55e';
            return (
              <div
                key={b.id}
                className="card"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  borderLeft: `5px solid ${statusColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.7 }}>
                        {b.category}
                      </span>
                      <h4 style={{ margin: '2px 0 4px', fontSize: '1.05rem' }}>{b.title}</h4>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: `${statusColor}25`,
                        color: statusColor,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                      }}
                    >
                      {b.status === 'overdue'
                        ? 'OVERDUE'
                        : b.status === 'due_soon'
                          ? `DUE IN ${b.days_until_due}D`
                          : 'OK'}
                    </span>
                  </div>

                  {b.provider && (
                    <div style={{ fontSize: '0.84rem', opacity: 0.8 }}>Provider: {b.provider}</div>
                  )}
                  {b.due_date && (
                    <div style={{ fontSize: '0.84rem', opacity: 0.8, marginTop: 2 }}>Due: {b.due_date}</div>
                  )}
                  {b.cost != null && (
                    <div style={{ fontWeight: 800, color: '#60a5fa', marginTop: 6 }}>${b.cost.toFixed(2)}</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleRenewItem(b)}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.2)',
                      color: '#4ade80',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    ✓ Renew (+1 yr)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(b.id)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.18)',
                      color: '#f87171',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <p className="org-empty">
          No vehicles or household renewals added yet. Click "+ Add" to track cars, rego, insurance, or bills!
        </p>
      )}
          </div>
        </div>
      </section>

      {/* Add Item Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 480, width: '100%', padding: 24, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>➕ Add to Organise</h3>
            <form onSubmit={handleCreateItem} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 10 }}
              >
                <option value="car">🚗 Vehicle</option>
                <option value="rego">🪪 Registration (Rego)</option>
                <option value="insurance">🛡️ Insurance</option>
                <option value="electricity">⚡ Electricity / Gas</option>
                <option value="internet">🌐 Internet / Phone</option>
                <option value="rates">🏡 Council Rates / Water</option>
                <option value="subscription">📺 Subscription</option>
              </select>

              <input
                type="text"
                placeholder={addCategory === 'car' ? 'Vehicle Nickname (e.g. Family SUV)' : 'Title (e.g. Home Insurance)'}
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                required
                style={{ padding: '10px 12px', borderRadius: 10 }}
              />

              {addCategory === 'car' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Make (e.g. Toyota)"
                      value={addMake}
                      onChange={(e) => setAddMake(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                    <input
                      type="text"
                      placeholder="Model (e.g. RAV4)"
                      value={addModel}
                      onChange={(e) => setAddModel(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <input
                      type="number"
                      placeholder="Year"
                      value={addYear}
                      onChange={(e) => setAddYear(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                    <input
                      type="text"
                      placeholder="Rego Plate"
                      value={addRego}
                      onChange={(e) => setAddRego(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                    <input
                      type="number"
                      placeholder="Odometer (km)"
                      value={addOdometer}
                      onChange={(e) => setAddOdometer(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Provider (e.g. NRMA, Origin)"
                    value={addProvider}
                    onChange={(e) => setAddProvider(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: 10 }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      type="date"
                      value={addDueDate}
                      onChange={(e) => setAddDueDate(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Cost ($)"
                      value={addCost}
                      onChange={(e) => setAddCost(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 10 }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.08)',
                    color: 'inherit',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '9px 20px', borderRadius: 10, fontWeight: 700 }}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Service History Modal */}
      {activeVehicle && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveVehicle(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>🔧 {activeVehicle.title} — Service Log</h3>
              <button
                type="button"
                onClick={() => setActiveVehicle(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAddService}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: 14,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                marginBottom: 16,
              }}
            >
              <input
                type="text"
                placeholder="Service Type"
                value={srvType}
                onChange={(e) => setSrvType(e.target.value)}
                style={{ padding: 8, borderRadius: 8 }}
              />
              <input
                type="date"
                value={srvDate}
                onChange={(e) => setSrvDate(e.target.value)}
                style={{ padding: 8, borderRadius: 8 }}
              />
              <input
                type="number"
                placeholder="Odometer (km)"
                value={srvMileage}
                onChange={(e) => setSrvMileage(e.target.value)}
                style={{ padding: 8, borderRadius: 8 }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cost ($)"
                value={srvCost}
                onChange={(e) => setSrvCost(e.target.value)}
                style={{ padding: 8, borderRadius: 8 }}
              />
              <input
                type="date"
                title="Next Service Due Date"
                value={srvNextDate}
                onChange={(e) => setSrvNextDate(e.target.value)}
                style={{ padding: 8, borderRadius: 8 }}
              />
              <input
                type="number"
                placeholder="Next Due Odometer (km)"
                value={srvNextMileage}
                onChange={(e) => setSrvNextMileage(e.target.value)}
                style={{ padding: 8, borderRadius: 8 }}
              />
              <input
                type="text"
                placeholder="Mechanic / Workshop"
                value={srvProvider}
                onChange={(e) => setSrvProvider(e.target.value)}
                style={{ gridColumn: '1 / -1', padding: 8, borderRadius: 8 }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ gridColumn: '1 / -1', padding: '9px', borderRadius: 8, fontWeight: 700 }}
              >
                + Log Service Entry
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {services.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {s.service_type} — {s.service_date}
                    </div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>
                      {s.mileage ? `${s.mileage} km` : ''} {s.cost ? `• $${s.cost}` : ''}{' '}
                      {s.provider ? `• ${s.provider}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteService(s.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
