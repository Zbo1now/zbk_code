import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock3, KeyRound, Shield, Users } from 'lucide-react';
import { authFetch } from '../../utils/auth';
import ActionDialog from '../ui/ActionDialog';

type RoleTab = 'users' | 'requests' | 'grants' | 'roles';

interface UserItem {
  userId: number;
  username: string;
  displayName?: string | null;
  email?: string | null;
  enabled: boolean;
  roles: string[];
  permissions: string[];
}

interface RoleItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  systemRole: boolean;
  permissions: string[];
}

interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
  description?: string | null;
}

interface RequestItem {
  id: number;
  userId: number;
  permissionCode: string;
  resourceType: string;
  resourceId?: string | null;
  reason?: string | null;
  status: string;
  reviewerId?: number | null;
  reviewComment?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
}

interface GrantItem {
  id: number;
  userId: number;
  permissionCode: string;
  resourceType: string;
  resourceId?: string | null;
  grantedBy?: number | null;
  sourceRequestId?: number | null;
  status: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt?: string | null;
}

const roleLabelMap: Record<string, string> = {
  ADMIN: '管理员',
  USER: '普通用户',
};

const permissionLabelMap: Record<string, string> = {
  'system.manage': '系统管理',
  'role.manage': '角色管理',
  'permission.approve': '权限审批',
  'kb.manage': '知识库管理',
  'kb.view': '知识库查看',
  'kb.upload': '知识上传',
  'doc.review': '文档审批',
};

const statusLabelMap: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  ACTIVE: '生效中',
  REVOKED: '已撤销',
};

const resourceTypeLabelMap: Record<string, string> = {
  KNOWLEDGE_BASE: '知识库',
  CATEGORY: '分类',
  DOCUMENT: '文档',
  GLOBAL: '全局',
};

const formatRoleLabel = (code: string) => roleLabelMap[code] || code;
const formatPermissionLabel = (code: string) => permissionLabelMap[code] || code;
const formatStatusLabel = (status: string) => statusLabelMap[status] || status;
const formatResourceTypeLabel = (resourceType: string) => resourceTypeLabelMap[resourceType] || resourceType;
const formatUserName = (user?: UserItem) => {
  if (!user) return '-';
  return user.displayName?.trim() || user.username;
};
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const normalized = value.includes('T') ? value.replace('T', ' ').replace('Z', '') : value;
  return normalized.slice(0, 19);
};

export default function RoleManagementCenter() {
  const [activeTab, setActiveTab] = useState<RoleTab>('users');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [grants, setGrants] = useState<GrantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message?: string; variant?: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message?: string;
    variant?: 'success' | 'warning' | 'error' | 'info';
    confirmLabel?: string;
    action: () => Promise<void> | void;
  } | null>(null);
  const [grantForm, setGrantForm] = useState({
    userId: '',
    permissionCode: '',
    resourceType: '',
    resourceId: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, permissionsRes, requestsRes, grantsRes] = await Promise.all([
        authFetch('/api/v1/auth/admin/users'),
        authFetch('/api/v1/auth/admin/roles'),
        authFetch('/api/v1/auth/admin/permissions'),
        authFetch('/api/v1/auth/admin/permission-requests'),
        authFetch('/api/v1/auth/admin/permission-grants'),
      ]);

      setUsers(usersRes.ok ? await usersRes.json() : []);
      setRoles(rolesRes.ok ? await rolesRes.json() : []);
      setPermissions(permissionsRes.ok ? await permissionsRes.json() : []);
      setRequests(requestsRes.ok ? await requestsRes.json() : []);
      setGrants(grantsRes.ok ? await grantsRes.json() : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const userMap = useMemo(
    () => Object.fromEntries(users.map((user) => [String(user.userId), user])),
    [users]
  );

  const metrics = useMemo(
    () => [
      { label: '用户总览', value: users.length, icon: <Users size={18} />, tone: 'text-blue-600 bg-blue-50' },
      { label: '角色数量', value: roles.length, icon: <Shield size={18} />, tone: 'text-indigo-600 bg-indigo-50' },
      { label: '待处理申请', value: requests.filter((item) => item.status === 'PENDING').length, icon: <Clock3 size={18} />, tone: 'text-amber-600 bg-amber-50' },
      { label: '生效授权', value: grants.filter((item) => item.status === 'ACTIVE').length, icon: <KeyRound size={18} />, tone: 'text-emerald-600 bg-emerald-50' },
    ],
    [users, roles, requests, grants]
  );

  const showNotice = (title: string, message?: string, variant: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    setNotice({ title, message, variant });
  };

  const submitAction = async (action: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await action();
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewRequest = async (request: RequestItem, action: 'APPROVE' | 'REJECT') => {
    setConfirmState({
      title: action === 'APPROVE' ? '通过权限申请' : '拒绝权限申请',
      message: `${formatPermissionLabel(request.permissionCode)} / 用户 ${formatUserName(userMap[String(request.userId)])}`,
      variant: action === 'APPROVE' ? 'success' : 'warning',
      confirmLabel: action === 'APPROVE' ? '确认通过' : '确认拒绝',
      action: async () => {
        await submitAction(async () => {
          const res = await authFetch(`/api/v1/auth/admin/permission-requests/${request.id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reviewComment: '' }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.message || '审批失败');
          }
          showNotice(action === 'APPROVE' ? '审批通过' : '已拒绝', `申请 #${request.id} 已处理。`, action === 'APPROVE' ? 'success' : 'warning');
        }).catch((error) => {
          showNotice('处理失败', error instanceof Error ? error.message : '请稍后重试。', 'error');
        });
      },
    });
  };

  const handleCreateGrant = async () => {
    if (!grantForm.userId || !grantForm.permissionCode || !grantForm.resourceType) {
      showNotice('信息不完整', '请先选择用户、权限和资源类型。', 'warning');
      return;
    }
    await submitAction(async () => {
      const res = await authFetch('/api/v1/auth/admin/permission-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: Number(grantForm.userId),
          permissionCode: grantForm.permissionCode,
          resourceType: grantForm.resourceType,
          resourceId: grantForm.resourceId.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || '新增授权失败');
      }
      setGrantForm({
        userId: '',
        permissionCode: '',
        resourceType: '',
        resourceId: '',
      });
      showNotice('授权成功', '新的用户授权已经创建。');
    }).catch((error) => {
      showNotice('授权失败', error instanceof Error ? error.message : '请稍后重试。', 'error');
    });
  };

  const handleRevokeGrant = async (grant: GrantItem) => {
    setConfirmState({
      title: '撤销用户授权',
      message: `确认撤销 ${formatPermissionLabel(grant.permissionCode)} 吗？`,
      variant: 'warning',
      confirmLabel: '确认撤销',
      action: async () => {
        await submitAction(async () => {
          const res = await authFetch(`/api/v1/auth/admin/permission-grants/${grant.id}/revoke`, {
            method: 'POST',
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.message || '撤销授权失败');
          }
          showNotice('撤销成功', `授权 #${grant.id} 已撤销。`);
        }).catch((error) => {
          showNotice('撤销失败', error instanceof Error ? error.message : '请稍后重试。', 'error');
        });
      },
    });
  };

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-6 pt-24 pb-12">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Role Management</div>
        <h1 className="mt-3 text-3xl font-bold text-slate-800">角色管理</h1>
        <p className="mt-2 text-slate-500">把用户总览、权限申请、用户授权和角色权限拆成独立工作区，便于后续继续扩展审批和配置能力。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-4 inline-flex rounded-2xl p-3 ${item.tone}`}>{item.icon}</div>
            <div className="text-sm text-slate-400">{item.label}</div>
            <div className="mt-2 text-3xl font-bold text-slate-800">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 px-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">管理分区</div>
          <div className="space-y-1">
            <SideButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={16} />} label="用户总览" />
            <SideButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<Clock3 size={16} />} label="权限申请" />
            <SideButton active={activeTab === 'grants'} onClick={() => setActiveTab('grants')} icon={<CheckCircle2 size={16} />} label="用户授权" />
            <SideButton active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} icon={<Shield size={16} />} label="角色权限" />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">正在加载角色管理数据...</div>
          ) : (
            <>
              {activeTab === 'users' && <UsersPanel users={users} />}
              {activeTab === 'requests' && (
                <RequestsPanel requests={requests} userMap={userMap} onReview={handleReviewRequest} submitting={submitting} />
              )}
              {activeTab === 'grants' && (
                <GrantsPanel
                  users={users}
                  permissions={permissions}
                  grants={grants}
                  userMap={userMap}
                  grantForm={grantForm}
                  onGrantFormChange={setGrantForm}
                  onCreateGrant={handleCreateGrant}
                  onRevokeGrant={handleRevokeGrant}
                  submitting={submitting}
                />
              )}
              {activeTab === 'roles' && <RolesPanel roles={roles} />}
            </>
          )}
        </motion.div>
      </div>

      <ActionDialog
        open={!!notice}
        title={notice?.title || ''}
        message={notice?.message}
        variant={notice?.variant || 'info'}
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
      <ActionDialog
        open={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message}
        variant={confirmState?.variant || 'warning'}
        confirmLabel={confirmState?.confirmLabel || '确认'}
        showCancel
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          const action = confirmState?.action;
          setConfirmState(null);
          await action?.();
        }}
      />
    </div>
  );
}

function SideButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UsersPanel({ users }: { users: UserItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-800">用户总览</h3>
        <p className="text-sm text-slate-400">这里展示用户当前角色和实际权限，不在这里调整基础角色。</p>
      </div>
      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.userId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-sm font-semibold text-slate-800">{formatUserName(user)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {user.username}
                  {user.email ? ` / ${user.email}` : ''}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${user.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    {user.enabled ? '启用中' : '已停用'}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">角色</div>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <span key={role} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                          {formatRoleLabel(role)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">暂无角色</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">权限</div>
                  <div className="flex flex-wrap gap-2">
                    {user.permissions.length > 0 ? (
                      user.permissions.map((permission) => (
                        <span key={permission} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                          {formatPermissionLabel(permission)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">暂无额外权限</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsPanel({
  requests,
  userMap,
  onReview,
  submitting,
}: {
  requests: RequestItem[];
  userMap: Record<string, UserItem>;
  onReview: (request: RequestItem, action: 'APPROVE' | 'REJECT') => Promise<void>;
  submitting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-800">权限申请审批</h3>
        <p className="text-sm text-slate-400">管理员可以直接通过或拒绝用户的权限申请。</p>
      </div>
      <div className="space-y-3">
        {requests.length === 0 && <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">当前还没有权限申请记录。</div>}
        {requests.map((request) => (
          <div key={request.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{formatPermissionLabel(request.permissionCode)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatUserName(userMap[String(request.userId)])} / {formatResourceTypeLabel(request.resourceType)}
                  {request.resourceId ? ` / ${request.resourceId}` : ''}
                </div>
                {request.reason && <div className="mt-3 text-sm text-slate-600">{request.reason}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    request.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-600'
                      : request.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-red-50 text-red-600'
                  }`}
                >
                  {formatStatusLabel(request.status)}
                </span>
                {request.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void onReview(request, 'APPROVE')}
                      disabled={submitting}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReview(request, 'REJECT')}
                      disabled={submitting}
                      className="rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      拒绝
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrantsPanel({
  users,
  permissions,
  grants,
  userMap,
  grantForm,
  onGrantFormChange,
  onCreateGrant,
  onRevokeGrant,
  submitting,
}: {
  users: UserItem[];
  permissions: PermissionItem[];
  grants: GrantItem[];
  userMap: Record<string, UserItem>;
  grantForm: { userId: string; permissionCode: string; resourceType: string; resourceId: string };
  onGrantFormChange: Dispatch<SetStateAction<{ userId: string; permissionCode: string; resourceType: string; resourceId: string }>>;
  onCreateGrant: () => Promise<void>;
  onRevokeGrant: (grant: GrantItem) => Promise<void>;
  submitting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-800">用户授权管理</h3>
        <p className="text-sm text-slate-400">支持手工新增授权，并对现有授权进行撤销。</p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={grantForm.userId}
            onChange={(e) => onGrantFormChange((prev) => ({ ...prev, userId: e.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">选择用户</option>
            {users.map((user) => (
              <option key={user.userId} value={user.userId}>
                {formatUserName(user)}
              </option>
            ))}
          </select>
          <select
            value={grantForm.permissionCode}
            onChange={(e) => onGrantFormChange((prev) => ({ ...prev, permissionCode: e.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">选择权限</option>
            {permissions.map((permission) => (
              <option key={permission.id} value={permission.code}>
                {formatPermissionLabel(permission.code)}
              </option>
            ))}
          </select>
          <select
            value={grantForm.resourceType}
            onChange={(e) => onGrantFormChange((prev) => ({ ...prev, resourceType: e.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            <option value="">选择资源类型</option>
            {Object.entries(resourceTypeLabelMap).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={grantForm.resourceId}
            onChange={(e) => onGrantFormChange((prev) => ({ ...prev, resourceId: e.target.value }))}
            placeholder="资源 ID，可为空"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void onCreateGrant()}
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            新增授权
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">权限</th>
              <th className="px-4 py-3">资源范围</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">生效时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grants.map((grant) => (
              <tr key={grant.id}>
                <td className="px-4 py-3 font-medium text-slate-700">{formatUserName(userMap[String(grant.userId)])}</td>
                <td className="px-4 py-3 text-slate-600">{formatPermissionLabel(grant.permissionCode)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {formatResourceTypeLabel(grant.resourceType)}
                  {grant.resourceId ? ` / ${grant.resourceId}` : ''}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${grant.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {formatStatusLabel(grant.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(grant.effectiveFrom)}</td>
                <td className="px-4 py-3">
                  {grant.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => void onRevokeGrant(grant)}
                      disabled={submitting}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
                    >
                      撤销授权
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolesPanel({ roles }: { roles: RoleItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-slate-800">角色权限模板</h3>
        <p className="text-sm text-slate-400">这里展示当前角色与默认权限挂载关系，后续可以继续扩成角色编辑器。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-800">{formatRoleLabel(role.code)}</div>
                  {role.systemRole && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">系统角色</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500">{role.description || role.name || '暂无说明'}</div>
              </div>
              <div className="text-xs text-slate-400">{role.permissions.length} 项权限</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <span key={permission} className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] text-indigo-600">
                  {formatPermissionLabel(permission)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
