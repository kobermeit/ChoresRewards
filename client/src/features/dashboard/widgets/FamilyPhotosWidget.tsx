import React, { memo, useState, useEffect } from 'react';
import { IconButton } from '../../../components/ui';
import { resolveAssetUrl, apiGet } from '../../../api';
import { SeasonalCardWatermark } from '../SeasonalCardWatermark';

export interface FamilyPhotosWidgetProps {
  onOpenScreensaver: () => void;
}

export const FamilyPhotosWidget: React.FC<FamilyPhotosWidgetProps> = memo(({ onOpenScreensaver }) => {
  const [screensaverMedia, setScreensaverMedia] = useState<Array<{ filename: string; url: string; type: string }>>([]);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    apiGet<{ success: boolean; media: Array<{ filename: string; url: string; type: string }> }>('screensaver/config')
      .then((res) => {
        if (res?.media) {
          setScreensaverMedia(res.media.filter((m) => m.type === 'image'));
        }
      })
      .catch(() => {});
  }, []);

  const currentPhoto = screensaverMedia[photoIdx] || null;

  return (
    <div
      className="dashboard-card dashboard-card-photos"
      id="dash-photos-card"
      title="Tap photo for slideshow"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}
    >
      <SeasonalCardWatermark variant={7} />
      <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fas fa-images" style={{ color: '#f472b6' }} />
        <span>Family Photos</span>
      </h3>
      <div className="dash-photo-slideshow" id="dash-photo-slideshow" style={{ height: 200, position: 'relative' }}>
        {currentPhoto ? (
          <>
            <img
              src={resolveAssetUrl(currentPhoto.url)}
              alt="Family"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }}
              onClick={onOpenScreensaver}
            />
            {screensaverMedia.length > 1 && (
              <>
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon="fas fa-chevron-left"
                  className="dash-photo-nav dash-photo-nav-prev"
                  aria-label="Previous photo"
                  style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '50%', width: 32, height: 32 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIdx((prev) => (prev > 0 ? prev - 1 : screensaverMedia.length - 1));
                  }}
                />
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon="fas fa-chevron-right"
                  className="dash-photo-nav dash-photo-nav-next"
                  aria-label="Next photo"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '50%', width: 32, height: 32 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIdx((prev) => (prev < screensaverMedia.length - 1 ? prev + 1 : 0));
                  }}
                />
              </>
            )}
          </>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 10,
              gap: 8,
              cursor: 'pointer',
            }}
            onClick={onOpenScreensaver}
          >
            <i className="fas fa-image" style={{ fontSize: '2rem', opacity: 0.4 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>No photos uploaded yet</span>
          </div>
        )}
      </div>
    </div>
  );
});

FamilyPhotosWidget.displayName = 'FamilyPhotosWidget';
