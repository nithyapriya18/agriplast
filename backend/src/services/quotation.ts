import {
  Polyhouse,
  PolyhouseConfiguration,
  Quotation,
  QuotationItem,
  MaterialSelection,
  MaterialType,
} from '@shared/types';
import { getMaterialById, getDefaultMaterialSelections } from '../data/materials';

/**
 * Generate quotation for polyhouse construction
 */
export async function generateQuotation(
  polyhouses: Polyhouse[],
  configuration: PolyhouseConfiguration,
  landAreaId: string,
  materialSelections?: { [itemCategory: string]: string[] }
): Promise<Quotation> {
  const items: QuotationItem[] = [];

  // Get material selections or use defaults
  const defaultSelections = getDefaultMaterialSelections();
  const pipeMaterialId = materialSelections?.pipe?.[0] || defaultSelections[MaterialType.PIPE];
  const gutterMaterialId = materialSelections?.gutter?.[0] || defaultSelections[MaterialType.GUTTER];
  const coverMaterialId = materialSelections?.cover?.[0] || defaultSelections[MaterialType.COVER];

  // Calculate total requirements
  let totalPipeLength = 0;
  let totalGutterLength = 0;
  let totalCoverArea = 0;
  let totalCorners = 0;

  polyhouses.forEach(polyhouse => {
    // Calculate perimeter for gutters
    const perimeter = 2 * (polyhouse.dimensions.length + polyhouse.dimensions.width);
    totalGutterLength += perimeter;

    // Calculate pipe requirements (frame structure)
    // Simplified: perimeter * 2 (top and bottom) + vertical supports every 2m
    const verticalSupports = Math.ceil(perimeter / 2);
    totalPipeLength += perimeter * 2 + verticalSupports * 2.5; // 2.5m height

    // Cover area (top + sides)
    totalCoverArea += polyhouse.innerArea * 1.3; // 30% extra for sides and overlap

    // Corners (simplified: 4 corners per polyhouse + internal connections)
    totalCorners += polyhouse.blocks.length * 4;
  });

  // Pipe item
  const pipeMaterial = getMaterialById(pipeMaterialId);
  if (pipeMaterial) {
    items.push({
      category: 'Structure - Pipes',
      description: `${pipeMaterial.name} for frame structure`,
      materialSelections: [
        {
          materialId: pipeMaterial.id,
          quantity: Math.ceil(totalPipeLength),
          unitPrice: pipeMaterial.unitPrice,
          totalPrice: Math.ceil(totalPipeLength) * pipeMaterial.unitPrice,
        },
      ],
      subtotal: Math.ceil(totalPipeLength) * pipeMaterial.unitPrice,
    });
  }

  // Gutter item
  const gutterMaterial = getMaterialById(gutterMaterialId);
  if (gutterMaterial) {
    items.push({
      category: 'Drainage - Gutters',
      description: `${gutterMaterial.name} for water drainage`,
      materialSelections: [
        {
          materialId: gutterMaterial.id,
          quantity: Math.ceil(totalGutterLength),
          unitPrice: gutterMaterial.unitPrice,
          totalPrice: Math.ceil(totalGutterLength) * gutterMaterial.unitPrice,
        },
      ],
      subtotal: Math.ceil(totalGutterLength) * gutterMaterial.unitPrice,
    });
  }

  // Cover item
  const coverMaterial = getMaterialById(coverMaterialId);
  if (coverMaterial) {
    items.push({
      category: 'Covering',
      description: `${coverMaterial.name} for polyhouse cover`,
      materialSelections: [
        {
          materialId: coverMaterial.id,
          quantity: Math.ceil(totalCoverArea),
          unitPrice: coverMaterial.unitPrice,
          totalPrice: Math.ceil(totalCoverArea) * coverMaterial.unitPrice,
        },
      ],
      subtotal: Math.ceil(totalCoverArea) * coverMaterial.unitPrice,
    });
  }

  // Connectors item
  const connectorMaterial = getMaterialById('connector-elbow-25mm');
  if (connectorMaterial) {
    items.push({
      category: 'Connectors & Fittings',
      description: 'Elbows, T-connectors, and cross connectors',
      materialSelections: [
        {
          materialId: connectorMaterial.id,
          quantity: totalCorners,
          unitPrice: connectorMaterial.unitPrice,
          totalPrice: totalCorners * connectorMaterial.unitPrice,
        },
      ],
      subtotal: totalCorners * connectorMaterial.unitPrice,
    });
  }

  // Foundation item
  const foundationMaterial = getMaterialById('foundation-concrete-mix');
  const anchorBoltMaterial = getMaterialById('foundation-anchor-bolt');
  if (foundationMaterial && anchorBoltMaterial) {
    const concreteVolume = polyhouses.length * 2; // 2 cubic meters per polyhouse (simplified)
    const anchorBolts = totalCorners / 2; // One bolt every 2 corners

    items.push({
      category: 'Foundation',
      description: 'Concrete foundation and anchor bolts',
      materialSelections: [
        {
          materialId: foundationMaterial.id,
          quantity: concreteVolume,
          unitPrice: foundationMaterial.unitPrice,
          totalPrice: concreteVolume * foundationMaterial.unitPrice,
        },
        {
          materialId: anchorBoltMaterial.id,
          quantity: anchorBolts,
          unitPrice: anchorBoltMaterial.unitPrice,
          totalPrice: anchorBolts * anchorBoltMaterial.unitPrice,
        },
      ],
      subtotal: concreteVolume * foundationMaterial.unitPrice + anchorBolts * anchorBoltMaterial.unitPrice,
    });
  }

  // Labor costs (typically 40-50% of material cost)
  const materialTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const laborCost = materialTotal * 0.45;

  items.push({
    category: 'Labor',
    description: 'Installation labor including foundation, structure assembly, and covering',
    materialSelections: [],
    subtotal: laborCost,
  });

  // Miscellaneous (fasteners, wires, etc.) - 5% of material cost
  const miscCost = materialTotal * 0.05;
  items.push({
    category: 'Miscellaneous',
    description: 'Fasteners, wires, clips, and other small items',
    materialSelections: [],
    subtotal: miscCost,
  });

  const totalCost = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalArea = polyhouses.reduce((sum, p) => sum + p.innerArea, 0);

  return {
    id: `quote-${Date.now()}`,
    landAreaId,
    polyhouses,
    configuration,
    items,
    totalCost: Math.round(totalCost),
    totalArea,
    createdAt: new Date(),
  };
}
