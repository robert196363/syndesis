import {
  Connection,
  QueryResults,
  SchemaNode,
  SchemaNodeInfo,
  ViewDefinition,
  ViewInfo,
  ViewSourceInfo,
  Virtualization,
  VirtualizationPublishingDetails,
  VirtualizationSourceStatus,
} from '@syndesis/models';
import { ITableInfo } from '@syndesis/ui';
import i18n from '../../../i18n';

interface IColumn {
  id: string;
  label: string;
}

export enum DvConnectionStatus {
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
  INACTIVE = 'INACTIVE',
}

/**
 * Recursively flattens the tree structure of SchemaNodes,
 * into an array of ViewInfos
 * @param viewInfos the array of ViewInfos
 * @param schemaNode the SchemaNode from which the ViewInfo is generated
 * @param nodePath path for current SchemaNode eg ['name0', 'name1', 'name2']
 * @param selectedViewNames names of views which are selected
 * @param existingViewNames names of views which exist (marked as update)
 */
export function generateViewInfos(
  viewInfos: ViewInfo[],
  schemaNode: SchemaNode,
  nodePath: string[],
  selectedViewNames: string[],
  existingViewNames: string[]
): void {
  if (schemaNode) {
    // Generate source path from nodePath array
    const sourcePath: string[] = [];
    for (const seg of nodePath) {
      sourcePath.push(seg);
    }

    // Creates ViewInfo if the SchemaNode is queryable
    if (schemaNode.queryable === true) {
      const vwName = schemaNode.name;
      // Determine whether ViewInfo should be selected
      const selectedState =
        selectedViewNames.findIndex(viewName => viewName === vwName) === -1
          ? false
          : true;
      // Deteremine whether ViewInfo is an update
      const hasExistingView =
        existingViewNames.findIndex(viewName => viewName === vwName) === -1
          ? false
          : true;
      // Create ViewInfo
      const view: ViewInfo = {
        connectionName: schemaNode.connectionName,
        isUpdate: hasExistingView,
        nodePath: sourcePath,
        selected: selectedState,
        viewName: vwName,
        viewSourceNode: schemaNode,
      };
      viewInfos.push(view);
    }
    // Update path for next level
    sourcePath.push(schemaNode.name);
    // Process this nodes children
    if (schemaNode.children && schemaNode.children.length > 0) {
      for (const childNode of schemaNode.children) {
        generateViewInfos(
          viewInfos,
          childNode,
          sourcePath,
          selectedViewNames,
          existingViewNames
        );
      }
    }
  }
}

/**
 * Recursively flattens the tree structure of SchemaNodes,
 * into an array of ViewInfos
 * @param viewInfos the array of ViewInfos
 * @param schemaNodes the SchemaNode[] array from which the ViewInfo is generated
 * @param nodePath path for current SchemaNode eg ['name0', 'name1', 'name2']
 * @param selectedViewNames names of views which are selected
 * @param existingViewNames names of views which exist (marked as update)
 */
export function generateAllViewInfos(
  viewInfos: ViewInfo[],
  schemaNodes: SchemaNode[],
  nodePath: string[],
  selectedViewNames: string[],
  existingViewNames: string[]
): void {
  if (schemaNodes && schemaNodes.length > 0) {
    // Process each schemaNode
    schemaNodes.map(schemaNode => {
      return generateViewInfos(
        viewInfos,
        schemaNode,
        nodePath,
        selectedViewNames,
        existingViewNames
      );
    });
  }
}

/**
 * Recursively flattens the tree structure of SchemaNodes,
 * into an array of SchemaNodeInfos
 * @param schemaNodeInfos the array of SchemaNodeInfos
 * @param schemaNode the SchemaNode from which the SchemaNodeInfo is generated
 * @param nodePath path for current SchemaNode eg ['sName', 'tName']
 */
export function generateSchemaNodeInfos(
  schemaNodeInfos: SchemaNodeInfo[],
  schemaNode: SchemaNode,
  nodePath: string[]
): void {
  if (schemaNode) {
    // Generate source path from nodePath array
    const sourcePath: string[] = [];
    for (const seg of nodePath) {
      sourcePath.push(seg);
    }

    // Creates SchemaNodeInfo if the SchemaNode is queryable
    if (schemaNode.queryable === true) {
      // Create SchemaNodeInfo
      const view: SchemaNodeInfo = {
        connectionName: schemaNode.connectionName,
        name: schemaNode.name,
        nodePath: sourcePath,
        teiidName: schemaNode.teiidName,
      };
      schemaNodeInfos.push(view);
    }
    // Update path for next level
    if (schemaNode.type !== 'root') {
      sourcePath.push(schemaNode.name);
    }
    // Process this nodes children
    if (schemaNode.children && schemaNode.children.length > 0) {
      for (const childNode of schemaNode.children) {
        generateSchemaNodeInfos(schemaNodeInfos, childNode, sourcePath);
      }
    }
  }
}

/**
 * Generate a ViewDefinition for the supplied info
 * @param schemaNodeInfo the SchemaNodeInfo for the view
 * @param dataVirtName the name of the virtualization
 * @param vwName the name for the view
 * @param vwDescription the (optional) description for the view
 */
export function generateViewDefinition(
  schemaNodeInfo: SchemaNodeInfo[],
  dataVirtName: string,
  vwName: string,
  vwDescription?: string
): ViewDefinition {
  const srcPaths: string[] = loadPaths(schemaNodeInfo);
  return getViewDefinition(
    vwName,
    dataVirtName,
    srcPaths,
    false,
    vwDescription
  );
}

function loadPaths(schemaNodeInfo: SchemaNodeInfo[]): string[] {
  const srcPaths: string[] = [];

  let index = 0;
  schemaNodeInfo.map(
    item =>
      (srcPaths[index++] =
        'schema=' + item.connectionName + '/table=' + item.teiidName)
  );

  return srcPaths;
}

/**
 * Generate a ViewDefinition for the supplied values.
 * @param name the view name
 * @param dataVirtName the name of the virtualization
 * @param srcPaths paths for the sources used in the view
 * @param userDef specifies if the ddl has been altered from defaults
 * @param descr the (optional) view description
 * @param viewDdl the (optional) view DDL
 */
function getViewDefinition(
  name: string,
  dataVirtName: string,
  srcPaths: string[],
  userDef: boolean,
  descr?: string,
  viewDdl?: string
) {
  // View Definition
  const viewDefn: ViewDefinition = {
    complete: true,
    dataVirtualizationName: dataVirtName,
    ddl: viewDdl ? viewDdl : '',
    description: descr ? descr : '',
    message: '',
    name,
    sourcePaths: srcPaths,
    status: 'SUCCESS',
    userDefined: userDef,
  };

  return viewDefn;
}

/**
 * Generate array of DvConnections.  Takes the incoming connections and updates the 'options',
 * based on the Virtualization connection status and selection state
 * @param conns the connections
 * @param virtualizationsSourceStatuses the available virtualization sources
 * @param selectedConn name of a selected connection
 */
export function generateDvConnections(
  conns: Connection[],
  virtualizationsSourceStatuses: VirtualizationSourceStatus[],
  selectedConn: string
): Connection[] {
  const dvConns: Connection[] = [];
  for (const conn of conns) {
    const virtSrcStatus = virtualizationsSourceStatuses.find(
      virtStatus => virtStatus.sourceName === conn.name
    );
    // If defined, a corresponding virtualization source was found
    if (virtSrcStatus) {
      let connStatus = DvConnectionStatus.INACTIVE;
      let schemaLoading = String(false);
      let selectionState = String(false);
      // status (ACTIVE, FAILED, INACTIVE)
      switch (virtSrcStatus.schemaState) {
        case 'ACTIVE':
          connStatus = DvConnectionStatus.ACTIVE;
          break;
        case 'FAILED':
          connStatus = DvConnectionStatus.FAILED;
          break;
        case 'MISSING':
          connStatus = DvConnectionStatus.INACTIVE;
          break;
        default:
          break;
      }
      // loading (true/false)
      schemaLoading = String(virtSrcStatus.loading);
      // selection
      if (conn.name === selectedConn) {
        selectionState = String(true);
      }
      conn.options = {
        dvLoading: schemaLoading,
        dvSelected: selectionState,
        dvStatus: connStatus,
      };
      dvConns.push(conn);
    }
  }
  return dvConns;
}

/**
 * Get the Connection DV status.  DV uses the options on a connection to set status
 * @param connection the connection
 */
export function getDvConnectionStatus(conn: Connection): string {
  return conn.options && conn.options.dvStatus
    ? conn.options.dvStatus
    : DvConnectionStatus.INACTIVE;
}

/**
 * Determine if the Connection is selected with the DV wizard.  DV uses the options on a connection to set selection
 * @param connection the connection
 */
export function isDvConnectionSelected(conn: Connection) {
  return conn.options &&
    conn.options.dvSelected &&
    conn.options.dvSelected === String(true)
    ? true
    : false;
}

/**
 * Determine if the Connection is loading.  DV uses the options on a connection to set loading state
 * @param connection the connection
 */
export function isDvConnectionLoading(conn: Connection) {
  return conn.options &&
    conn.options.dvLoading &&
    conn.options.dvLoading === String(true)
    ? true
    : false;
}

/**
 * Get the OData url from the virtualization, if available
 * @param virtualization the Virtualization
 */
export function getOdataUrl(virtualization: Virtualization): string {
  return virtualization.odataHostName
    ? 'https://' + virtualization.odataHostName + '/odata'
    : '';
}

/**
 * Construct the pod build log url from the supplied info
 * @param consoleUrl the console url
 * @param namespace namespace of the DV pod
 * @param publishPodName name of the DV pod
 */
export function getPodLogUrl(
  consoleUrl: string,
  namespace?: string,
  publishPodName?: string
): string {
  return namespace && publishPodName
    ? `${consoleUrl}/project/${namespace}/browse/pods/${publishPodName}?tab=logs`
    : '';
}

/**
 * Get publishing state details for the specified virtualization
 * @param consoleUrl the console url
 * @param virtualization the Virtualization
 */
export function getPublishingDetails(
  consoleUrl: string,
  virtualization: Virtualization
): VirtualizationPublishingDetails {
  // Determine published state
  const publishStepDetails: VirtualizationPublishingDetails = {
    state: virtualization.publishedState,
    stepNumber: 0,
    stepText: i18n.t('data:buildStatus.' + virtualization.publishedState),
    stepTotal: 3,
  };
  switch (virtualization.publishedState) {
    case 'CONFIGURING':
      publishStepDetails.stepNumber = 1;
      break;
    case 'BUILDING':
      publishStepDetails.stepNumber = 2;
      break;
    case 'DEPLOYING':
      publishStepDetails.stepNumber = 3;
      break;
    default:
      break;
  }
  if (virtualization.publishPodName) {
    publishStepDetails.logUrl = getPodLogUrl(
      consoleUrl,
      virtualization.podNamespace,
      virtualization.publishPodName
    );
  }
  return publishStepDetails;
}

/**
 *
 * @param currDetails the current publishing details
 * @returns a suitable `Label` style for the publishing state
 */
export function getStateLabelStyle(
  currDetails: VirtualizationPublishingDetails,
): 'primary' | 'danger' | 'default' {
  let result: 'primary' | 'danger' | 'default';
  switch (currDetails.state) {
    case 'RUNNING':
      result = 'primary';
      break;
    case 'FAILED':
      result = 'danger';
      break;
    default: // in-progress
      result = 'default';
      break;
  }
  return result;
}

/**
 * @param currDetails the current publishing details
 * @returns the `Label` text representing the publish state
 */
export function getStateLabelText(
  currDetails: VirtualizationPublishingDetails,
): string {
  let result = '';
  switch (currDetails.state) {
    case 'RUNNING':
      result = i18n.t('data:publishedDataVirtualization');
      break;
    case 'FAILED':
      result = i18n.t('shared:Error');
      break;
    case 'NOTFOUND':
      result = i18n.t('shared:Draft');
      break;
    case 'BUILDING':
    case 'CONFIGURING':
    case 'DEPLOYING':
    case 'SUBMITTED':
      result = i18n.t('data:publishInProgress');
      break;
    case 'CANCELLED':
    case 'DELETE_SUBMITTED':
    case 'DELETE_REQUEUE':
    case 'DELETE_DONE':
      result = i18n.t('data:unpublishInProgress');
      break;
    default: // should not get here as exhausted all cases
      break;
  }
  return result;
}

/**
 * @param publishStepDetails the publishing details being checked
 * @returns `true` if state is a publishing step
 */
export function isPublishStep(
  publishStepDetails: VirtualizationPublishingDetails
): boolean {
  if (
    publishStepDetails.state === 'CONFIGURING' ||
    publishStepDetails.state === 'BUILDING' ||
    publishStepDetails.state === 'DEPLOYING'
  ) {
    return true;
  }

  return false;
}

/**
 * Checks to see if a delete, publish, or unpublish operation is in-progress. When the state is a
 * publish step state, `false` is returned.
 * @param currDetails the current publishing details
 * @returns `true` if a state operation is in-progress
 */
export function isStateOperationInProgress(
  currDetails: VirtualizationPublishingDetails,
): boolean {
  let result = false;
  switch (currDetails.state) {
    case 'SUBMITTED':
    case 'CANCELLED':
    case 'DELETE_SUBMITTED':
    case 'DELETE_REQUEUE':
    case 'DELETE_DONE':
      result = true;
      break;
    default:
      break;
  }
  return result;
}

/**
 * Generate preview SQL for the specified view definition
 * @param viewDefinition the ViewDefinition
 */
export function getPreviewSql(viewDefinition: ViewDefinition): string {
  return 'SELECT * FROM ' + viewDefinition.name;
}

/**
 * Get rows from the query results
 * @param qResults the query results
 */
export function getQueryRows(qResults: QueryResults): Array<{}> {
  const allRows = qResults.rows ? qResults.rows : [];
  return allRows
    .map(row => row.row)
    .map(row =>
      row.reduce(
        // tslint:disable-next-line: no-shadowed-variable
        (row, r, idx) => ({
          ...row,
          [qResults.columns[idx].name]: r,
        }),
        {}
      )
    );
}

/**
 * Get columns from the query results
 * @param qResults the query results
 */
export function getQueryColumns(qResults: QueryResults): IColumn[] {
  const columns = [];
  if (qResults.columns) {
    for (const col of qResults.columns) {
      columns.push({ id: col.name, label: col.label });
    }
  }
  return columns;
}

/**
 * convert ViewSourceInfo respone into TableColumn array
 * @param sourceInfo the view's source info
 */
export function generateTableColumns(sourceInfo: ViewSourceInfo): ITableInfo[] {
  const tblColumns: ITableInfo[] = [];
  // For each schema, create a TableColumns object for each table and add to array
  sourceInfo.schemas.map(schema => {
    return schema.tables.map(table => {
      const ti = {
        columnNames: table.columns.map(p => p.name),
        name: schema.name + '.' + table.name,
      } as ITableInfo;
      tblColumns.push(ti);
      return ti;
    });
  });
  return tblColumns;
}
