export const ROLE_OWNER = 'owner'
export const ROLE_OPERATIONS = 'operations'
export const ROLE_AUDITOR = 'auditor'

const ROLE_PERMISSIONS = {
  [ROLE_OWNER]: ['*'],
  [ROLE_OPERATIONS]: [
    'dashboard.view',
    'orders.view',
    'needs_attention.view',
    'enquiries.view',
    'enquiries.manage',
    'decision_history.view',
    'suspicious_pdfs.view',
    'courier.check',
    'courier.decide',
    'aggregator.view',
  ],
  [ROLE_AUDITOR]: [
    'dashboard.view',
    'orders.view',
    'needs_attention.view',
    'enquiries.view',
    'decision_history.view',
    'audit.view',
    'suspicious_pdfs.view',
    'aggregator.view',
  ],
}

export function hasPermission(admin, permission) {
  const role = admin?.role || (admin?.is_superuser ? ROLE_OWNER : ROLE_OPERATIONS)
  const permissions = ROLE_PERMISSIONS[role] || []
  if (permissions.includes('*') || permissions.includes(permission)) return true
  return Boolean(
    (admin?.special_access || []).some((item) => item.permission === permission && item.enabled)
  )
}

export const ROLE_OPTIONS = [
  { value: ROLE_OWNER, label: 'Owner' },
  { value: ROLE_OPERATIONS, label: 'Operations Manager' },
  { value: ROLE_AUDITOR, label: 'Auditor / Viewer' },
]
