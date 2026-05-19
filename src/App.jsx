import { useState, useMemo, useEffect } from 'react';
import { Flame, ShieldCheck, AlertTriangle, Plus, Search, Edit2, Trash2, MapPin, X, Activity, Navigation, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { addMonths, isBefore, format, parseISO, differenceInDays } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MAINTENANCE_INTERVAL_MONTHS = 12;

const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('fireExtinguishers');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      { id: '1', name: 'FE-KU-01', location: 'อาคารสารนิเทศ 50 ปี - ชั้น 1 หน้าลิฟต์', coordinates: null, lastMaintenance: '2025-06-15' },
      { id: '2', name: 'FE-KU-02', location: 'อาคารจักรพันธ์เพ็ญศิริ - โถงทางเข้าหลัก', coordinates: null, lastMaintenance: '2025-01-10' },
      { id: '3', name: 'FE-KU-03', location: 'สำนักหอสมุด - ชั้น 2 โซนหนังสืออ้างอิง', coordinates: null, lastMaintenance: '2024-05-20' },
      { id: '4', name: 'FE-KU-04', location: 'ตึกชูชาติ กำภู (คณะวิศวะ) - ทางเดินหน้าห้องพักอาจารย์', coordinates: null, lastMaintenance: '2025-05-30' },
    ];
  });

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    coordinates: null,
    lastMaintenance: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    localStorage.setItem('fireExtinguishers', JSON.stringify(items));
  }, [items]);

  const processedItems = useMemo(() => {
    const today = new Date();
    
    return items.map(item => {
      const lastMaintDate = parseISO(item.lastMaintenance);
      const nextMaintDate = addMonths(lastMaintDate, MAINTENANCE_INTERVAL_MONTHS);
      const daysUntilMaintenance = differenceInDays(nextMaintDate, today);
      
      let status = 'good';
      if (daysUntilMaintenance < 0) {
        status = 'danger';
      } else if (daysUntilMaintenance <= 30) {
        status = 'warning';
      }

      return {
        ...item,
        nextMaintenanceDate: format(nextMaintDate, 'yyyy-MM-dd'),
        nextMaintenanceFormatted: format(nextMaintDate, 'dd MMM yyyy'),
        lastMaintenanceFormatted: format(lastMaintDate, 'dd MMM yyyy'),
        daysUntilMaintenance,
        status
      };
    });
  }, [items]);

  const filteredItems = processedItems.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.location.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = processedItems.length;
    const expired = processedItems.filter(i => i.status === 'danger').length;
    const warning = processedItems.filter(i => i.status === 'warning').length;
    return { total, expired, warning };
  }, [processedItems]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        location: item.location,
        coordinates: item.coordinates || null,
        lastMaintenance: item.lastMaintenance
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        location: '',
        coordinates: null,
        lastMaintenance: format(new Date(), 'yyyy-MM-dd')
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingItem) {
      setItems(items.map(item => item.id === editingItem.id ? { ...item, ...formData } : item));
    } else {
      setItems([...items, { id: generateId(), ...formData }]);
    }
    handleCloseModal();
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const performMaintenance = (id) => {
    if (confirm('Record maintenance for today?')) {
      const today = format(new Date(), 'yyyy-MM-dd');
      setItems(items.map(item => item.id === id ? { ...item, lastMaintenance: today } : item));
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        }));
        setIsLocating(false);
      },
      (error) => {
        alert('Unable to retrieve your location');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Use standard font for PDF, jsPDF standard doesn't support Thai natively well without custom fonts, 
    // but for ID, Date, it will work. For Thai we might just try standard or warn.
    // If we really want full Thai support, we'd need to load a TTF font. 
    // We will stick to basic for now as it will render as much as it can.
    doc.text("FireGuard - Maintenance Report", 14, 15);
    
    const tableColumn = ["ID", "Location", "Status", "Last Maint.", "Next Maint.", "Coords"];
    const tableRows = [];
    
    filteredItems.forEach(item => {
      const coordsData = item.coordinates ? `${item.coordinates.lat.toFixed(4)}, ${item.coordinates.lng.toFixed(4)}` : 'N/A';
      const rowData = [
        item.name,
        item.location,
        item.status.toUpperCase(),
        item.lastMaintenanceFormatted,
        item.nextMaintenanceFormatted,
        coordsData
      ];
      tableRows.push(rowData);
    });
    
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { font: "helvetica", fontSize: 9 }, // use standard font
      headStyles: { fillColor: [255, 51, 51] }
    });
    
    doc.save(`FireGuard_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const exportExcel = () => {
    const exportData = filteredItems.map(item => ({
      "Unit ID": item.name,
      "Location": item.location,
      "Status": item.status.toUpperCase(),
      "Days Until Maint.": item.daysUntilMaintenance,
      "Last Maintenance": item.lastMaintenanceFormatted,
      "Next Maintenance": item.nextMaintenanceFormatted,
      "Coordinates (Lat, Lng)": item.coordinates ? `${item.coordinates.lat}, ${item.coordinates.lng}` : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    
    XLSX.writeFile(workbook, `FireGuard_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <div className="stat-icon red">
            <Flame size={32} strokeWidth={2.5} />
          </div>
          <div className="header-title">
            <h1>FireGuard System</h1>
            <p>Fire Extinguisher Tracking</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-export pdf" onClick={exportPDF} title="Download PDF Report">
            <FileText size={18} />
            <span>PDF</span>
          </button>
          <button className="btn-export excel" onClick={exportExcel} title="Download Excel Report">
            <FileSpreadsheet size={18} />
            <span>Excel</span>
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{color: 'white'}}>
            <ShieldCheck size={28} />
          </div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Units</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{color: 'var(--status-warning)', borderColor: 'rgba(255, 234, 0, 0.2)', background: 'rgba(255, 234, 0, 0.1)'}}>
            <Activity size={28} />
          </div>
          <div className="stat-info">
            <h3>{stats.warning}</h3>
            <p>Needs Action (≤30d)</p>
          </div>
        </div>
        <div className="glass-panel stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={28} />
          </div>
          <div className="stat-info">
            <h3>{stats.expired}</h3>
            <p>Overdue</p>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="controls-section">
          <div className="search-box">
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <input 
              type="text" 
              placeholder="Search by ID or Location..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="add-btn" onClick={() => handleOpenModal()}>
            <Plus size={20} />
            <span>Add Extinguisher</span>
          </button>
        </div>

        <div className="table-container">
          <div className="mobile-cards">
            {filteredItems.map(item => (
              <div className="mobile-card" key={item.id}>
                <div className="mobile-card-header">
                  <div className="location-cell">
                    <div className="location-icon">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div className="location-text">{item.name}</div>
                      <div className="location-subtext">{item.location}</div>
                      {item.coordinates && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${item.coordinates.lat},${item.coordinates.lng}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="coords-link"
                        >
                          <Navigation size={12} /> View Map
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    {item.status === 'good' && (
                      <span className="status-badge status-good">
                        <ShieldCheck size={14} /> Normal
                      </span>
                    )}
                    {item.status === 'warning' && (
                      <span className="status-badge status-warning">
                        <Activity size={14} /> Soon ({item.daysUntilMaintenance}d)
                      </span>
                    )}
                    {item.status === 'danger' && (
                      <span className="status-badge status-danger">
                        <AlertTriangle size={14} /> Overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Last Maint:</span>
                    <span className="date-cell">{item.lastMaintenanceFormatted}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Next Maint:</span>
                    <span className="date-cell" style={{ color: item.status === 'danger' ? 'var(--status-danger)' : item.status === 'warning' ? 'var(--status-warning)' : 'inherit' }}>
                      {item.nextMaintenanceFormatted}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-footer action-btns">
                  <button className="icon-btn full-btn" title="Record Maintenance" onClick={() => performMaintenance(item.id)}>
                    <ShieldCheck size={18} /> Record
                  </button>
                  <button className="icon-btn" title="Edit" onClick={() => handleOpenModal(item)}>
                    <Edit2 size={18} />
                  </button>
                  <button className="icon-btn" title="Delete" onClick={() => handleDelete(item.id)}>
                    <Trash2 size={18} color="#ff4d4d" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <table className="desktop-table">
            <thead>
              <tr>
                <th>Unit ID & Location</th>
                <th>Status</th>
                <th>Last Maint.</th>
                <th>Next Maint.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="location-cell">
                      <div className="location-icon">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <div className="location-text">{item.name}</div>
                        <div className="location-subtext">{item.location}</div>
                        {item.coordinates && (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${item.coordinates.lat},${item.coordinates.lng}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="coords-link"
                          >
                            <Navigation size={12} /> {item.coordinates.lat.toFixed(5)}, {item.coordinates.lng.toFixed(5)}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {item.status === 'good' && (
                      <span className="status-badge status-good">
                        <ShieldCheck size={14} /> Normal
                      </span>
                    )}
                    {item.status === 'warning' && (
                      <span className="status-badge status-warning">
                        <Activity size={14} /> Soon ({item.daysUntilMaintenance}d)
                      </span>
                    )}
                    {item.status === 'danger' && (
                      <span className="status-badge status-danger">
                        <AlertTriangle size={14} /> Overdue
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="date-cell">{item.lastMaintenanceFormatted}</div>
                  </td>
                  <td>
                    <div className="date-cell" style={{ color: item.status === 'danger' ? 'var(--status-danger)' : item.status === 'warning' ? 'var(--status-warning)' : 'inherit' }}>
                      {item.nextMaintenanceFormatted}
                    </div>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="icon-btn" title="Record Maintenance" onClick={() => performMaintenance(item.id)}>
                        <ShieldCheck size={18} />
                      </button>
                      <button className="icon-btn" title="Edit" onClick={() => handleOpenModal(item)}>
                        <Edit2 size={18} />
                      </button>
                      <button className="icon-btn" title="Delete" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={18} color="#ff4d4d" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="5" style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                    No fire extinguishers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingItem ? 'Edit Extinguisher' : 'Add Extinguisher'}</h2>
              <button className="close-btn" type="button" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Unit ID / Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. FE-KU-05"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Location Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. อาคารสารนิเทศ 50 ปี - ชั้น 1"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>GPS Coordinates (Optional)</label>
                <div className="location-input-group">
                  <input 
                    type="text" 
                    readOnly
                    placeholder="Not set"
                    value={formData.coordinates ? `${formData.coordinates.lat.toFixed(5)}, ${formData.coordinates.lng.toFixed(5)}` : ''}
                  />
                  <button type="button" className="btn-location" onClick={getLocation} disabled={isLocating}>
                    {isLocating ? <Activity size={18} className="spin" /> : <Navigation size={18} />}
                    {isLocating ? 'Locating...' : 'Get Location'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Last Maintenance Date</label>
                <input 
                  type="date" 
                  required
                  value={formData.lastMaintenance}
                  onChange={(e) => setFormData({...formData, lastMaintenance: e.target.value})}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
