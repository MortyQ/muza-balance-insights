## Purpose

The category ring of the home «Spending» block: how the period's spending splits by category, at a glance and on pointing.

## ADDED Requirements

### Requirement: Category ring

The «Spending» block SHALL show a ring of the shown categories, in the list's order and colours, each segment sized by
its spending, with «Other» taking the rest of the total. Segments SHALL have rounded ends and a visible gap between them.
The period's total SHALL stay inside the ring. With no spending the ring SHALL be a plain track.

#### Scenario: Several categories

- **WHEN** the period has spending in several categories
- **THEN** the ring shows one rounded segment per category with a gap between each two, and the total inside

#### Scenario: One category

- **WHEN** all the spending is in one category
- **THEN** the ring is one whole segment with no gap

#### Scenario: No spending

- **WHEN** the period has no spending
- **THEN** the ring is a plain track and pointing at it changes nothing

### Requirement: Category ring hover

Pointing at a segment SHALL widen it slightly, within the ring's own space, and the ring's centre SHALL show that
category instead of the total: its name, its amount and its share, as the category list writes them. Leaving the
segment SHALL bring the total back.

#### Scenario: Pointing at a segment

- **WHEN** the user points at a category's segment
- **THEN** the segment widens without being cut off, and the centre shows that category's name, amount and share

#### Scenario: Leaving the ring

- **WHEN** the pointer leaves the segment
- **THEN** the centre shows the total again

#### Scenario: Person picked

- **WHEN** a person is picked in the global filters and the user points at a segment
- **THEN** the centre shows that person's spending in the category
