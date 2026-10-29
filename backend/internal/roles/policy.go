package roles

import "slices"

// Rule says who may change a role from the dashboard. Security decisions live
// in reviewed code, not in catalog rows that a database write could change.
type Rule struct {
	// ManagedBy is the role an actor must currently hold to grant or revoke.
	ManagedBy string
	// Confirm asks the dashboard to confirm before changing the role.
	Confirm bool
	// Protected roles cannot be revoked from yourself, and the last active
	// holder cannot be removed.
	Protected bool
}

// Policy lists dashboard-editable roles. Any other catalog role, including
// member and roles added later without a rule here, is read-only.
var Policy = map[string]Rule{
	"staff":   {ManagedBy: "staff", Confirm: true, Protected: true},
	"foundry": {ManagedBy: "staff"},
	"alumni":  {ManagedBy: "staff"},
}

// CanManage reports whether an actor with these current roles may change role.
func CanManage(actorRoles []string, role string) bool {
	rule, ok := Policy[role]
	return ok && slices.Contains(actorRoles, rule.ManagedBy)
}
