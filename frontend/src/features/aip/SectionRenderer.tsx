import TableRenderer from './renderers/TableRenderer';
import ObjectRenderer from './renderers/ObjectRenderer';
import HybridRenderer from './renderers/HybridRenderer';
import { SECTION_COLUMNS } from './sectionConfig';
import type { ObjectColumnDef, ArrayColumnDef } from './sectionConfig';

interface SectionRendererProps {
  data: any;
  dataType: string;
  sectionId: string;
}

/**
 * Factory component that dispatches to the correct sub-renderer
 * based on the backend's `data_type` field, passing section-specific
 * column config for official AIP header/label rendering.
 */
export default function SectionRenderer({ data, dataType, sectionId }: SectionRendererProps) {
  const config = SECTION_COLUMNS[sectionId];

  switch (dataType) {
    case 'array':
      return (
        <TableRenderer
          data={data}
          columnConfig={config?.type === 'array' ? (config.columns as ArrayColumnDef[]) : undefined}
        />
      );
    case 'object':
      return (
        <ObjectRenderer
          data={data}
          columnConfig={
            config?.type === 'object' ? (config.columns as ObjectColumnDef[]) : undefined
          }
        />
      );
    case 'hybrid':
      return <HybridRenderer data={data} />;
    default:
      if (Array.isArray(data)) return <TableRenderer data={data} />;
      if (typeof data === 'object' && data !== null) return <ObjectRenderer data={data} />;
      return <HybridRenderer data={data} />;
  }
}
