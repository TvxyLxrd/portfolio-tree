import { Component, HostListener, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import {
  AutoCompleteCompleteEvent,
  AutoCompleteModule,
} from 'primeng/autocomplete';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';

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
  imports: [
    FormsModule,
    AgGridAngular,
    AutoCompleteModule,
    ButtonModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MenuModule,
    SelectModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly drawerVisible = signal(false);
  protected readonly activeTreeFilter = signal('');
  protected readonly portfolioOptions: string[] = [];
  protected readonly portfolioMenuItems: MenuItem[] = [
    { label: 'New tree', icon: 'pi pi-plus-circle' },
    { label: 'Edit', icon: 'pi pi-pen-to-square' },
    { label: 'Delete', icon: 'pi pi-trash' },
  ];
  protected readonly instrumentOptions: string[] = [];
  protected instrumentSuggestions: string[] = [];
  protected selectedPortfolio: string | null = null;
  protected instrumentQuery: string | null = null;
  protected readonly rowData: PortfolioRow[] = [];
  protected readonly columnOptions: ColumnOption[] = [
    { field: 'ticker', label: '' },
    { field: 'price', label: '' },
    { field: 'dayChange', label: '' },
    { field: 'weight', label: '' },
    { field: 'marketValue', label: '' },
    { field: 'pnl', label: '' },
    { field: 'pe', label: '' },
    { field: 'dividendYield', label: '' },
    { field: 'beta', label: '' },
    { field: 'sector', label: '' },
  ];
  protected readonly gridTheme = themeQuartz;

  private gridApi?: GridApi<PortfolioRow>;

  protected readonly defaultColDef: ColDef<PortfolioRow> = {
    sortable: false,
    filter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressHeaderFilterButton: true,
    width: 120,
    minWidth: 80,
  };

  protected readonly autoGroupColumnDef: ColDef<PortfolioRow> = {
    field: 'name',
    headerName: '',
    pinned: 'left',
    width: 240,
    minWidth: 160,
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
      headerName: '',
      cellClass: 'ticker-cell',
    },
    {
      field: 'price',
      headerName: '',
      valueFormatter: this.currencyFormatter,
      type: 'numericColumn',
    },
    {
      field: 'dayChange',
      headerName: '',
      valueFormatter: this.percentFormatter,
      cellClassRules: this.changeClassRules,
      type: 'numericColumn',
    },
    {
      field: 'weight',
      headerName: '',
      valueFormatter: this.percentFormatter,
      type: 'numericColumn',
    },
    {
      field: 'marketValue',
      headerName: '',
      valueFormatter: this.integerCurrencyFormatter,
      type: 'numericColumn',
    },
    {
      field: 'pnl',
      headerName: '',
      valueFormatter: this.signedCurrencyFormatter,
      cellClassRules: this.changeClassRules,
      type: 'numericColumn',
    },
    {
      field: 'pe',
      headerName: '',
      valueFormatter: this.decimalFormatter,
      type: 'numericColumn',
    },
    {
      field: 'dividendYield',
      headerName: '',
      valueFormatter: this.percentFormatter,
      type: 'numericColumn',
    },
    {
      field: 'beta',
      headerName: '',
      valueFormatter: this.decimalFormatter,
      type: 'numericColumn',
    },
    {
      field: 'sector',
      headerName: '',
    },
  ];

  protected onGridReady(event: GridReadyEvent<PortfolioRow>): void {
    this.gridApi = event.api;
    this.applyResponsiveGrid();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.applyResponsiveGrid();
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

  protected searchInstruments(event: AutoCompleteCompleteEvent): void {
    const query = event.query.trim().toLocaleLowerCase();

    this.instrumentSuggestions = query
      ? this.instrumentOptions.filter((instrument) =>
          instrument.toLocaleLowerCase().includes(query),
        )
      : [...this.instrumentOptions];
  }

  private applyResponsiveGrid(): void {
    const mobile = window.innerWidth <= 760;
    const columnWidth = mobile ? 96 : 120;

    this.gridApi?.setGridOption('defaultColDef', {
      ...this.defaultColDef,
      width: columnWidth,
      minWidth: mobile ? 72 : 80,
    });
    this.gridApi?.setGridOption('autoGroupColumnDef', {
      ...this.autoGroupColumnDef,
      pinned: mobile ? null : 'left',
      minWidth: mobile ? 160 : 200,
      width: mobile ? 168 : 240,
    });
    this.gridApi?.setColumnWidths(
      this.columnOptions.map((option) => ({
        key: String(option.field),
        newWidth: columnWidth,
      })),
    );
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
