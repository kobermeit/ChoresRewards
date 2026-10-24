import React from 'react';
import { CustomDropdown } from '../../../components/ui/CustomDropdown';

export interface LaneQuickAddDropdownProps {
  storeId: string;
  storeName: string;
  items: Array<{ name: string; qty?: string }>;
  onSelect: (itemName: string) => void;
  showFilter?: boolean;
}

export const LaneQuickAddDropdown: React.FC<LaneQuickAddDropdownProps> = ({
  storeName,
  items,
  onSelect,
  showFilter = true,
}) => {
  const options = items.map((it) => ({
    value: it.name,
    label: it.name,
    qty: it.qty,
  }));

  return (
    <CustomDropdown
      value=""
      placeholder="+ Add item…"
      options={options}
      onChange={onSelect}
      showFilter={showFilter}
      allowCustomValue={true}
      customValueLabel={(text) => `Add "${text}" to ${storeName}`}
      height={36}
      ariaLabel={`Add item to ${storeName}`}
    />
  );
};
