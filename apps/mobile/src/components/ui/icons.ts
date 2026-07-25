/**
 * Iconsax (Bulk) — the Bureau icon set, matching `iconsax-reactjs` on the web.
 *
 * Icons are deep-imported one by one on purpose: the package barrel pulls in
 * ~1000 SVG components (10 MB) which would blow up the Metro bundle.
 */
import Activity from "iconsax-react-native/dist/esm/Activity";
import Add from "iconsax-react-native/dist/esm/Add";
import AddCircle from "iconsax-react-native/dist/esm/AddCircle";
import ArrowDown2 from "iconsax-react-native/dist/esm/ArrowDown2";
import ArrowLeft2 from "iconsax-react-native/dist/esm/ArrowLeft2";
import ArrowRight2 from "iconsax-react-native/dist/esm/ArrowRight2";
import Book1 from "iconsax-react-native/dist/esm/Book1";
import Calendar1 from "iconsax-react-native/dist/esm/Calendar1";
import Category from "iconsax-react-native/dist/esm/Category";
import Chart21 from "iconsax-react-native/dist/esm/Chart21";
import Clock from "iconsax-react-native/dist/esm/Clock";
import CloseCircle from "iconsax-react-native/dist/esm/CloseCircle";
import Code1 from "iconsax-react-native/dist/esm/Code1";
import Danger from "iconsax-react-native/dist/esm/Danger";
import Document from "iconsax-react-native/dist/esm/Document";
import DocumentText1 from "iconsax-react-native/dist/esm/DocumentText1";
import Edit2 from "iconsax-react-native/dist/esm/Edit2";
import Element3 from "iconsax-react-native/dist/esm/Element3";
import Flag from "iconsax-react-native/dist/esm/Flag";
import Folder2 from "iconsax-react-native/dist/esm/Folder2";
import Grid2 from "iconsax-react-native/dist/esm/Grid2";
import Home2 from "iconsax-react-native/dist/esm/Home2";
import LogoutCurve from "iconsax-react-native/dist/esm/LogoutCurve";
import Magicpen from "iconsax-react-native/dist/esm/Magicpen";
import Menu from "iconsax-react-native/dist/esm/Menu";
import Minus from "iconsax-react-native/dist/esm/Minus";
import Moon from "iconsax-react-native/dist/esm/Moon";
import More from "iconsax-react-native/dist/esm/More";
import Note1 from "iconsax-react-native/dist/esm/Note1";
import Notification from "iconsax-react-native/dist/esm/Notification";
import ProfileCircle from "iconsax-react-native/dist/esm/ProfileCircle";
import QuoteUp from "iconsax-react-native/dist/esm/QuoteUp";
import Refresh2 from "iconsax-react-native/dist/esm/Refresh2";
import SearchNormal1 from "iconsax-react-native/dist/esm/SearchNormal1";
import Setting2 from "iconsax-react-native/dist/esm/Setting2";
import Sort from "iconsax-react-native/dist/esm/Sort";
import Star1 from "iconsax-react-native/dist/esm/Star1";
import Sun1 from "iconsax-react-native/dist/esm/Sun1";
import TaskSquare from "iconsax-react-native/dist/esm/TaskSquare";
import Text from "iconsax-react-native/dist/esm/Text";
import TextBlock from "iconsax-react-native/dist/esm/TextBlock";
import TickCircle from "iconsax-react-native/dist/esm/TickCircle";
import TickSquare from "iconsax-react-native/dist/esm/TickSquare";
import Timer1 from "iconsax-react-native/dist/esm/Timer1";
import Trash from "iconsax-react-native/dist/esm/Trash";
import User from "iconsax-react-native/dist/esm/User";

export const Icons = {
  activity: Activity,
  add: Add,
  addCircle: AddCircle,
  analytics: Chart21,
  back: ArrowLeft2,
  book: Book1,
  calendar: Calendar1,
  category: Category,
  chevronDown: ArrowDown2,
  chevronRight: ArrowRight2,
  clock: Clock,
  close: CloseCircle,
  code: Code1,
  danger: Danger,
  divider: Minus,
  doc: DocumentText1,
  docPlain: Document,
  drag: Sort,
  edit: Edit2,
  flag: Flag,
  folder: Folder2,
  grid: Grid2,
  heading: TextBlock,
  home: Home2,
  list: Menu,
  logout: LogoutCurve,
  magic: Magicpen,
  more: More,
  note: Note1,
  notification: Notification,
  paragraph: Text,
  profile: ProfileCircle,
  quote: QuoteUp,
  refresh: Refresh2,
  search: SearchNormal1,
  settings: Setting2,
  star: Star1,
  sun: Sun1,
  moon: Moon,
  tasks: TaskSquare,
  timer: Timer1,
  tickCircle: TickCircle,
  tickSquare: TickSquare,
  trash: Trash,
  user: User,
  workspace: Element3,
} as const;

export type IconName = keyof typeof Icons;
