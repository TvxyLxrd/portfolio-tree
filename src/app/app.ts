import { Component, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellClassParams,
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  ValueFormatterParams,
  themeQuartz,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { TreeNode } from 'primeng/api';
import { DrawerModule } from 'primeng/drawer';
import { TreeModule } from 'primeng/tree';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface PortfolioRow {
  name?: string;
  ticker?: string;
  price?: number;
  dayChange?: number;
  weight?: number;
  marketValue?: number;
  pnl?: number;
  pe?: number;
  dividendYield?: number;
  beta?: number;
  sector?: string;
  children?: PortfolioRow[];
}

interface ColumnOption {
  field: keyof PortfolioRow;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [AgGridAngular, DrawerModule, TreeModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly drawerVisible = signal(false);
  protected readonly columnMenuVisible = signal(false);
  protected readonly activeTreeFilter = signal('');
  protected readonly treeNodes: TreeNode[] = [];
  protected readonly rowData: PortfolioRow[] = [];
  protected readonly columnOptions: ColumnOption[] = [
    { field: 'ticker', label: 'Ticker' },
    { field: 'price', label: 'Price' },
    { field: 'dayChange', label: 'Day %' },
    { field: 'weight', label: 'Weight' },
    { field: 'marketValue', label: 'Market value' },
    { field: 'pnl', label: 'P&L' },
    { field: 'pe', label: 'P/E' },
    { field: 'dividendYield', label: 'Dividend' },
    { field: 'beta', label: 'Beta' },
    { field: 'sector', label: 'Sector' },
  ];
  protected readonly gridTheme = themeQuartz;

  private gridApi?: GridApi<PortfolioRow>;

  protected readonly defaultColDef: ColDef<PortfolioRow> = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110,
    flex: 1,
  };

  protected readonly autoGroupColumnDef: ColDef<PortfolioRow> = {
    field: 'name',
    headerName: 'Instrument / group',
    pinned: 'left',
    minWidth: 290,
    flex: 1.7,
    cellRendererParams: {
      suppressCount: true,
    },
  };

  private readonly changeClassRules = {
    'positive-cell': (params: CellClassParams<PortfolioRow>) => Number(params.value) > 0,
    'negative-cell': (params: CellClassParams<PortfolioRow>) => Number(params.value) < 0,
  };

  protected readonly columnDefs: ColDef<PortfolioRow>[] = [
    {
      field: 'ticker',
      headerName: 'Ticker',
      minWidth: 95,
      maxWidth: 115,
      cellClass: 'ticker-cell',
    },
    {
      field: 'price',
      headerName: 'Price',
      minWidth: 110,
      valueFormatter: this.currencyFormatter,
      type: 'numericColumn',
    },
    {
      field: 'dayChange',
      headerName: 'Day %',
      minWidth: 105,
      valueFormatter: this.percentFormatter,
      cellClassRules: this.changeClassRules,
      type: 'numericColumn',
      sort: 'desc',
    },
    {
      field: 'weight',
      headerName: 'Weight',
      minWidth: 110,
      valueFormatter: this.percentFormatter,
      type: 'numericColumn',
    },
    {
      field: 'marketValue',
      headerName: 'Market value',
      minWidth: 145,
      valueFormatter: this.integerCurrencyFormatter,
      type: 'numericColumn',
    },
    {
      field: 'pnl',
      headerName: 'P&L',
      minWidth: 120,
      valueFormatter: this.signedCurrencyFormatter,
      cellClassRules: this.changeClassRules,
      type: 'numericColumn',
    },
    {
      field: 'pe',
      headerName: 'P/E',
      minWidth: 90,
      maxWidth: 105,
      valueFormatter: this.decimalFormatter,
      type: 'numericColumn',
    },
    {
      field: 'dividendYield',
      headerName: 'Dividend',
      minWidth: 110,
      valueFormatter: this.percentFormatter,
      type: 'numericColumn',
    },
    {
      field: 'beta',
      headerName: 'Beta',
      minWidth: 90,
      maxWidth: 105,
      valueFormatter: this.decimalFormatter,
      type: 'numericColumn',
    },
    {
      field: 'sector',
      headerName: 'Sector',
      minWidth: 150,
    },
  ];

  protected onGridReady(event: GridReadyEvent<PortfolioRow>): void {
    this.gridApi = event.api;
  }

  protected setQuickFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.activeTreeFilter.set(value);
    this.gridApi?.setGridOption('quickFilterText', value);
  }

  protected clearFilter(): void {
    this.activeTreeFilter.set('');
    this.gridApi?.setGridOption('quickFilterText', '');
  }

  protected openFilterPanel(): void {
    this.gridApi?.openToolPanel('filters');
  }

  protected addInstrument(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) {
      return;
    }

    this.activeTreeFilter.set(value);
    this.gridApi?.setGridOption('quickFilterText', value);
    input.value = '';
  }

  protected toggleColumn(option: ColumnOption, event: Event): void {
    const visible = (event.target as HTMLInputElement).checked;
    this.gridApi?.setColumnsVisible([String(option.field)], visible);
  }

  protected resetColumns(): void {
    this.gridApi?.resetColumnState();
    this.columnMenuVisible.set(false);
  }

  private currencyFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null
      ? ''
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
        }).format(params.value);
  }

  private integerCurrencyFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null
      ? ''
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(params.value);
  }

  private signedCurrencyFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    if (params.value == null) {
      return '';
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Math.abs(params.value));

    return `${params.value > 0 ? '+' : params.value < 0 ? '-' : ''}${formatted}`;
  }

  private percentFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null ? '' : `${params.value.toFixed(2)}%`;
  }

  private decimalFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null ? '' : params.value.toFixed(2);
  }
}
