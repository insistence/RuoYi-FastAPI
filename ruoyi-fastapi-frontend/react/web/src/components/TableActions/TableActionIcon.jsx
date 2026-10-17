import {
  AuditOutlined,
  BarsOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteFilled,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileProtectOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  MedicineBoxOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SettingOutlined,
  SwapOutlined,
  UndoOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons'

// Keep action names stable for pages and generated templates.
const icons = {
  Switch: SwapOutlined,
  Lock: LockOutlined,
  ArrowDown: DownOutlined,
  CaretRight: CaretRightOutlined,
  CircleCheck: CheckCircleOutlined,
  CircleClose: CloseCircleOutlined,
  Clock: ClockCircleOutlined,
  Connection: LinkOutlined,
  Delete: DeleteOutlined,
  DeleteFilled,
  DocumentChecked: FileProtectOutlined,
  Download: DownloadOutlined,
  Edit: EditOutlined,
  FirstAidKit: MedicineBoxOutlined,
  Key: KeyOutlined,
  Operation: BarsOutlined,
  Plus: PlusOutlined,
  Refresh: ReloadOutlined,
  RefreshLeft: UndoOutlined,
  Setting: SettingOutlined,
  SwitchButton: PoweroffOutlined,
  Tickets: AuditOutlined,
  Upload: UploadOutlined,
  User: UserOutlined,
  VideoPause: PauseCircleOutlined,
  View: EyeOutlined,
}

export default function TableActionIcon({ name }) {
  const Icon = icons[name]
  return Icon ? (
    <span
      className="ruoyi-table-action-icon"
      aria-hidden="true"
    >
      <Icon />
    </span>
  ) : null
}
