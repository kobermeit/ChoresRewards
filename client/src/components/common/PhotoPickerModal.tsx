import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button, EmptyState } from '../ui';
import { resolveAssetUrl, resolveApiUrl } from '../../api';

export interface StockPhotoItem {
  url: string;
  label: string;
}

export interface PhotoPickerModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  stockImages: StockPhotoItem[];
  selectedUrl?: string;
  onSelect: (url: string, label?: string) => void;
}

interface CustomImageItem {
  filename: string;
  url: string;
  mtime: number;
}

export const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  open,
  onClose,
  title = 'Choose Photo',
  stockImages,
  selectedUrl,
  onSelect,
}) => {
  const [activeTab, setActiveTab] = useState<'default' | 'my_photos'>('default');
  const [customPhotos, setCustomPhotos] = useState<CustomImageItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCustomPhotos = async () => {
    try {
      setLoadingPhotos(true);
      const res = await fetch(resolveApiUrl('media/custom_library'), { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.images)) {
          setCustomPhotos(json.images);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCustomPhotos();
    }
  }, [open, activeTab]);

  const handleBulkFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch(resolveApiUrl('media/bulk_upload'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Upload failed');
      }

      await fetchCustomPhotos();
      setActiveTab('my_photos');

      // If user uploaded exactly one photo from here, select it immediately
      if (json.files && json.files.length === 1 && json.files[0].url) {
        onSelect(json.files[0].url, json.files[0].originalname || 'Custom Photo');
        onClose();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const isMyPhotosEmpty = customPhotos.length === 0;

  // Footer: User rule:
  // "make sure the upload more button is in the modal footer when there are photos.
  // For the empty state, don't show in footer, just show in content."
  const modalFooter =
    activeTab === 'my_photos' && !isMyPhotosEmpty ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Button
          type="button"
          variant="secondary"
          icon={uploading ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'}
          onClick={triggerUpload}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Upload More'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    ) : (
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    );

  return (
    <Modal open={open} onClose={onClose} title={title} icon="fas fa-images" maxWidth={640} footer={modalFooter}>
      {/* Hidden Multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleBulkFilesSelected}
        style={{ display: 'none' }}
      />

      {/* Tabs Header */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('default')}
          style={{
            padding: '8px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'default' ? 700 : 500,
            borderRadius: 'var(--btn-radius, 8px)',
            background: activeTab === 'default' ? 'var(--primary-color, #3b82f6)' : 'transparent',
            color: activeTab === 'default' ? '#ffffff' : '#94a3b8',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <i className="fas fa-palette" style={{ marginRight: 6 }} />
          Default
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my_photos')}
          style={{
            padding: '8px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'my_photos' ? 700 : 500,
            borderRadius: 'var(--btn-radius, 8px)',
            background: activeTab === 'my_photos' ? 'var(--primary-color, #3b82f6)' : 'transparent',
            color: activeTab === 'my_photos' ? '#ffffff' : '#94a3b8',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <i className="fas fa-camera" style={{ marginRight: 6 }} />
          My Photos {customPhotos.length > 0 && `(${customPhotos.length})`}
        </button>
      </div>

      {uploadError && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 14,
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
        >
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
          {uploadError}
        </div>
      )}

      {/* Tab 1: Default Stock Illustrations */}
      {activeTab === 'default' && (
        <div
          className="photo-picker-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 12,
            maxHeight: 460,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {stockImages.map((item) => {
            const isSelected = selectedUrl === item.url;
            return (
              <div
                key={item.url}
                onClick={() => {
                  onSelect(item.url, item.label);
                  onClose();
                }}
                className={`photo-picker-tile ${isSelected ? 'photo-picker-tile-selected' : ''}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 11',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#0f172a',
                  border: isSelected ? '2.5px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: isSelected
                    ? '0 0 14px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0, 0, 0, 0.5)'
                    : '0 3px 10px rgba(0, 0, 0, 0.25)',
                  cursor: 'pointer',
                  transition: 'transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                {/* Edge-to-Edge Image (Like Meal Library) */}
                <img
                  src={resolveAssetUrl(item.url)}
                  alt={item.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />

                {/* Bottom Shadow Gradient & Text Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '24px 8px 7px',
                    background:
                      'linear-gradient(to top, rgba(10, 15, 29, 0.95) 0%, rgba(10, 15, 29, 0.6) 60%, transparent 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: isSelected ? '#93c5fd' : '#f8fafc',
                      lineHeight: 1.2,
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                  >
                    {item.label}
                  </span>
                </div>

                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      background: '#3b82f6',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                      border: '1.5px solid rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    <i className="fas fa-check" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: My Photos */}
      {activeTab === 'my_photos' && (
        <div>
          {loadingPhotos ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading photos...
            </div>
          ) : isMyPhotosEmpty ? (
            <EmptyState
              icon="fas fa-camera"
              title="No photos yet"
              description="Upload your own photos or artwork from your device to use on cards across the entire household."
            >
              <Button
                type="button"
                variant="primary"
                icon={uploading ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'}
                onClick={triggerUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Photos'}
              </Button>
            </EmptyState>
          ) : (
            <div
              className="photo-picker-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 12,
                maxHeight: 460,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {customPhotos.map((img) => {
                const isSelected = selectedUrl === img.url;
                return (
                  <div
                    key={img.filename}
                    onClick={() => {
                      onSelect(img.url, img.filename);
                      onClose();
                    }}
                    className={`photo-picker-tile ${isSelected ? 'photo-picker-tile-selected' : ''}`}
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16 / 11',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#0f172a',
                      border: isSelected ? '2.5px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: isSelected
                        ? '0 0 14px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0, 0, 0, 0.5)'
                        : '0 3px 10px rgba(0, 0, 0, 0.25)',
                      cursor: 'pointer',
                      transition: 'transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                      if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                  >
                    <img
                      src={resolveAssetUrl(img.url)}
                      alt={img.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />

                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '24px 8px 7px',
                        background:
                          'linear-gradient(to top, rgba(10, 15, 29, 0.95) 0%, rgba(10, 15, 29, 0.6) 60%, transparent 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: isSelected ? '#93c5fd' : '#f8fafc',
                          lineHeight: 1.2,
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                        title={img.filename}
                      >
                        {img.filename.replace(/^\d+_[a-z0-9]+_/, '')}
                      </span>
                    </div>

                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 7,
                          right: 7,
                          background: '#3b82f6',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                          border: '1.5px solid rgba(255, 255, 255, 0.8)',
                        }}
                      >
                        <i className="fas fa-check" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
