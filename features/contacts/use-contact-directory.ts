import { useMemo } from 'react'
import { contactRelationshipLabel, type Contact } from './contact-model'
import { relationshipTagOptions, relationshipTagsForContact, type RelationshipTagDefinition } from '@/lib/relationship-tags'

export function useContactDirectory({ contacts, customTags, search, relationshipFilter, selectedId }: {
  contacts: Contact[]; customTags: RelationshipTagDefinition[]; search: string; relationshipFilter: string; selectedId: string | null
}) {
  return useMemo(() => {
    const availableRelationshipTags = [...relationshipTagOptions, ...customTags.map((tag) => tag.tag_key)]
    const filtered = contacts.filter((contact) => {
      const query = search.toLowerCase()
      const tags = relationshipTagsForContact(contact)
      const relationship = contactRelationshipLabel(contact, customTags).toLowerCase()
      const matchesFilter = !relationshipFilter || (relationshipFilter === 'trusted' ? contact.trusted : tags.includes(relationshipFilter))
      if (!matchesFilter) return false
      if (!query) return true
      return contact.name.toLowerCase().includes(query) || contact.email?.toLowerCase().includes(query) || contact.slack_handle?.toLowerCase().includes(query) || contact.phone_number?.toLowerCase().includes(query) || contact.contact_identifiers?.some((identifier) => `${identifier.platform} ${identifier.identifier} ${identifier.label || ''}`.toLowerCase().includes(query)) || relationship.includes(query)
    })
    const selectedContact = selectedId ? contacts.find((contact) => contact.id === selectedId) || null : null
    const selectedRelationshipSummary = selectedContact ? (Array.isArray(selectedContact.contact_relationship_summaries) ? selectedContact.contact_relationship_summaries[0] || null : selectedContact.contact_relationship_summaries || null) : null
    return { availableRelationshipTags, filtered, selectedContact, selectedRelationshipSummary }
  }, [contacts, customTags, relationshipFilter, search, selectedId])
}
