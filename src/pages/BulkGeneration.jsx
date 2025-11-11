import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { 
  FaBarcode, 
  FaFileDownload, 
  FaCheckSquare, 
  FaSquare,
  FaDownload,
  FaFilePdf
} from 'react-icons/fa';
import { productService } from '../services';
import api from '../services/api-inventory';

export default function BulkGeneration() {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productService.getAll();
      return response.data.data;
    }
  });

  const products = productsData?.products || [];

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p._id));
    }
    setSelectAll(!selectAll);
  };

  const toggleProduct = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const downloadBulkBarcodes = async () => {
    if (selectedProducts.length === 0) {
      toast.warning('Please select at least one product');
      return;
    }

    try {
      setIsGenerating(true);
      toast.info('Generating barcodes... Please wait');

      const response = await api.post('/bulk/barcodes', 
        { productIds: selectedProducts },
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `barcodes-${Date.now()}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Generated ${selectedProducts.length} barcodes!`);
    } catch (error) {
      toast.error('Failed to generate barcodes');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadBulkDochettes = async () => {
    if (selectedProducts.length === 0) {
      toast.warning('Please select at least one product');
      return;
    }

    try {
      setIsGenerating(true);
      toast.info('Generating dochettes... Please wait');

      const response = await api.post('/bulk/dochettes', 
        { productIds: selectedProducts },
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dochettes-${Date.now()}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Generated ${selectedProducts.length} dochettes!`);
    } catch (error) {
      toast.error('Failed to generate dochettes');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAllBarcodes = async () => {
    if (products.length === 0) {
      toast.warning('No products available');
      return;
    }

    try {
      setIsGenerating(true);
      toast.info(`Generating barcodes for all ${products.length} products... Please wait`);

      const response = await api.get('/bulk/barcodes/all', 
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-barcodes-${Date.now()}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Generated ${products.length} barcodes!`);
    } catch (error) {
      toast.error('Failed to generate all barcodes');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAllDochettes = async () => {
    if (products.length === 0) {
      toast.warning('No products available');
      return;
    }

    try {
      setIsGenerating(true);
      toast.info(`Generating dochettes for all ${products.length} products... Please wait`);

      const response = await api.get('/bulk/dochettes/all', 
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-dochettes-${Date.now()}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Generated ${products.length} dochettes!`);
    } catch (error) {
      toast.error('Failed to generate all dochettes');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) return <div className="loading">Loading products...</div>;

  return (
    <div>
      <div className="page-header">
        <h1><FaFileDownload /> Bulk Barcode Generation</h1>
      </div>

      {/* Action Buttons */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          <button 
            className="btn btn-primary" 
            onClick={downloadAllBarcodes}
            disabled={isGenerating || products.length === 0}
          >
            <FaBarcode /> Download All Barcodes ({products.length})
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={downloadAllDochettes}
            disabled={isGenerating || products.length === 0}
          >
            <FaFilePdf /> Download All Dochettes ({products.length})
          </button>
          <button 
            className="btn btn-success" 
            onClick={downloadBulkBarcodes}
            disabled={isGenerating || selectedProducts.length === 0}
          >
            <FaDownload /> Download Selected Barcodes ({selectedProducts.length})
          </button>
          <button 
            className="btn btn-info" 
            onClick={downloadBulkDochettes}
            disabled={isGenerating || selectedProducts.length === 0}
          >
            <FaDownload /> Download Selected Dochettes ({selectedProducts.length})
          </button>
        </div>
        {isGenerating && (
          <div style={{ marginTop: '15px', textAlign: 'center', color: '#3498db' }}>
            <strong>⏳ Generating files... This may take a moment for large selections.</strong>
          </div>
        )}
      </div>

      {/* Product Selection */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3>Select Products</h3>
          <button 
            className="btn btn-secondary"
            onClick={toggleSelectAll}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            {selectAll ? <FaCheckSquare /> : <FaSquare />}
            {selectAll ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {products.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            No products available. Add products first.
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Select</th>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Barcode</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr 
                    key={product._id}
                    style={{ 
                      backgroundColor: selectedProducts.includes(product._id) ? '#e3f2fd' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleProduct(product._id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product._id)}
                        onChange={() => toggleProduct(product._id)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </td>
                    <td><strong>{product.sku}</strong></td>
                    <td>{product.name}</td>
                    <td>{product.categoryId?.name || 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          backgroundColor: product.colorId?.hexCode || '#ccc',
                          border: '1px solid #ddd',
                          borderRadius: '3px'
                        }}></div>
                        {product.colorId?.name || 'N/A'}
                      </div>
                    </td>
                    <td>{product.sizeId?.label || 'N/A'}</td>
                    <td>
                      <code style={{ 
                        fontSize: '0.85em', 
                        backgroundColor: '#f5f5f5', 
                        padding: '2px 6px', 
                        borderRadius: '3px' 
                      }}>
                        {product.barcode || 'N/A'}
                      </code>
                    </td>
                    <td>{product.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginTop: '20px', backgroundColor: '#f0f9ff' }}>
        <h4>📖 How to Use</h4>
        <ol style={{ paddingLeft: '20px', marginBottom: 0 }}>
          <li><strong>Quick Actions:</strong> Use the buttons at the top to download all barcodes/dochettes for all products at once.</li>
          <li><strong>Selective Download:</strong> Check the products you want, then click "Download Selected" buttons.</li>
          <li><strong>ZIP File:</strong> All files are packaged in a ZIP archive for easy download.</li>
          <li><strong>File Names:</strong> Each barcode/dochette is named with the product SKU (e.g., barcode-TS001.png).</li>
          <li><strong>Print Ready:</strong> All barcodes and labels are high-quality and ready for printing.</li>
        </ol>
      </div>
    </div>
  );
}
