import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, Input, FormField } from '../../../components/ui';
import { ShoppingStore } from '../../../types';

export interface NewStoreModalProps {
  open: boolean;
  onClose: () => void;
  stores: ShoppingStore[];
  onSaveStore: (store: { id: string; name: string; icon: string }) => Promise<void>;
}

const STORE_EMOJIS = ['🛒', '🏪', '🥦', '🥩', '💊', '🥖', '🏬', '🛍️', '🍎', '🐟'];

export const NewStoreModal: React.FC<NewStoreModalProps> = ({
  open,
  onClose,
  stores: _stores,
  onSaveStore,
}) => {
  const [storeName, setStoreName] = useState('');
  const [storeIcon, setStoreIcon] = useState('🛒');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = storeName.trim();
    if (!name) return;
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Math.floor(Math.random() * 9000 + 1000);

    setSubmitting(true);
    try {
      await onSaveStore({ id, name, icon: storeIcon || '🛒' });
      setStoreName('');
      setStoreIcon('🛒');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Store">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Store Name" required>
          <Input
            placeholder="e.g. Costco, Coles, Chemist Warehouse"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Store Icon">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '1.6rem' }}>{storeIcon}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STORE_EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant={storeIcon === emoji ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStoreIcon(emoji)}
                  style={{
                    fontSize: '1.2rem',
                    padding: '4px 8px',
                    border: storeIcon === emoji ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </div>
        </FormField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!storeName.trim() || submitting}>
            Save Store
          </Button>
        </div>
      </form>
    </Modal>
  );
};
