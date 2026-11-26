"""Generate the school navigation graph from the traced plans and corridors."""

import json
import math
import re
from collections import defaultdict
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parent
POINT_PATTERN = re.compile(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)')
# Graph nodes use three decimal places, but SVG wall coordinates can be more precise.
WALL_TOLERANCE = 0.001
WALKABLE_ROOMS = {'parter-pracownia-zawodowa'}

# Corridor centerlines in SVG coordinates. The central stair is entered from the east.
lines = {
    'pracownie': [
        [(70, 245), (209, 245), (220, 230), (220, 148), (774, 148)],
        [(220, 230), (220, 276), (240, 276)],
        [(460, 148), (480, 148), (480, 260), (472, 268), (472, 285)],
        [(600, 148), (600, 283), (646, 283)],
        [(774, 148), (774, 350)],
        [(774, 205), (784, 205)],
        [(774, 239.5), (784, 239.5)],
    ],
    'niski-parter': [
        [(118, 80), (133, 80), (133, 125), (730, 125)],
        [(133, 125), (133, 169)],
        [(695, 158), (655, 158)],
        [(695, 125), (695, 171), (695, 197), (685, 197), (685, 205)],
        [(695, 197), (695, 205)],
        [(730, 125), (736, 125), (736, 230)],
        [(990, 177), (990, 230)],
    ],
    'parter': [
        [(708, 615), (708, 483), (133, 483), (133, 530)],
        [(708, 515), (653, 515)],
        [(708, 483), (708, 430), (708, 355), (700, 355), (700, 52)],
        [(708, 522), (746, 522), (746, 452), (756, 452)],
        [(746, 522), (934, 522), (934, 532), (964, 532)],
        [(934, 522), (934, 517)],
        [(708, 555), (683, 555)],
        [(708, 370), (733, 375), (748, 369), (748, 362)],
        [(748, 369), (761, 363)],
        [(733, 375), (772, 384)],
        [(708, 392), (756, 401)],
        [(700, 52), (651, 52)],
        [(290, 255), (120, 255)],
        [(637, 370), (650, 370), (708, 370)],
    ],
    'pietro-1': [
        [(130, 147), (130, 101), (709, 101), (709, 130)],
        [(685, 130), (709, 130), (930, 130)],
        [(685, 133), (654, 133)],
        [(685, 101), (685, 180.5)],
        [(930, 130), (930, 150)],
    ],
    'pietro-2': [
        [(127, 133), (127, 92), (702, 92), (702, 120)],
        [(677, 120), (702, 120), (920, 120)],
        [(677, 120), (647, 120)],
        [(677, 92), (677, 167.5)],
    ],
}

door_specs = defaultdict(list)
room_joins = []


def door(level, room_id, wall_point, corridor_point, verified=True):
    door_specs[level].append((room_id, wall_point, corridor_point, verified))


def row(level, entries, wall_y, corridor_y):
    for room_id, x, *confidence in entries:
        verified = confidence[0] if confidence else True
        door(level, room_id, (x, wall_y), (x, corridor_y), verified)


def join(level, room_a, wall_a, room_b, wall_b, verified=True):
    room_joins.append((level, room_a, wall_a, room_b, wall_b, verified))


# Door coordinates are traced from openings on each plan.
# Workshop upper/lower rooms: no corridor along common wall between rows.

level = 'pracownie'
row(level, [
    ('bez-numeru-1', 293),
    ('02', 352),
    ('bez-numeru-3', 439),
    ('wc-1', 465),
    ('wc-1', 518),
    ('bez-numeru-4', 570),
    ('bez-numeru-6', 684),
    ('bez-numeru-7', 719),
    ('bez-numeru-7', 745),
    ('bez-numeru-10', 777),
], 137, 148)
door(level, 'bez-numeru-5', (631, 119), (631, 148))
# Room 09 meets the shared upper aisle via an explicit bend.
door(level, '09', (788, 141), (774, 148))
for room_id, y, verified in [('09a', 156, True), ('bez-numeru-15', 216, True), ('bez-numeru-15', 229, True), ('bez-numeru-18', 263, True), ('012', 323, True)]:
    door(level, room_id, (788, y), (774, y), verified)
door(level, 'bez-numeru-11', (76, 229), (76, 245))
door(level, 'bez-numeru-12', (167, 229), (167, 245))
row(level, [
    ('029', 284),
    ('028', 320),
    ('026', 450),
    ('silownia', 666),
], 159, 148)
door(level, 'bez-numeru-13', (452, 247), (480, 247), True)
door(level, 'silownia', (630, 159), (630, 148), True)
door(level, 'pracownia-zawodowa', (243, 276), (240, 276))
door(level, 'biblioteka', (470, 290), (472, 285))
door(level, 'sala-konferencyjna', (475, 273), (472, 268))
door(level, 'informatyczna-1', (585, 279), (600, 279))
door(level, 'robotyka', (600, 296), (600, 283))
door(level, 'informatyczna-2', (648, 283), (646, 283))
door(level, 'informatyczna-3', (761, 286), (774, 286))
# The corridor stub from x480 to x472 is diagonal. Attach at the explicit bend.
# Low ground

level = 'niski-parter'
door(level, '01', (115, 80), (118, 80))
row(level, [
    ('032', 255),
    ('032', 382),
    ('033', 454),
    ('034', 485),
    ('035', 508),
    ('036', 548),
    ('037', 594),
    ('038', 640),
    ('039', 672),
    ('040', 712),
], 109, 125)
lines[level].append([(695, 151), (719.5, 151)])
door(level, 'wc', (682, 197), (685, 197))
door(level, '041', (719.5, 160), (719.5, 151))
door(level, '042', (695, 207), (695, 205))
door(level, 'bez-numeru-13', (739, 125), (736, 125), False)
door(level, 'bez-numeru-17', (988, 185), (990, 185))
door(level, 'bez-numeru-16', (989, 169), (990, 177), False)
# Ground floor. Each bottom-row room uses its own visible doorway into lower corridor.

level = 'parter'
row(level, [
    ('24', 135),
    ('bez-numeru-15', 176.5),
    ('22', 252),
    ('bez-numeru-17', 328.5),
    ('bez-numeru-17', 390),
    ('20', 531),
    ('19', 632),
], 466, 483)
for room_id, y, verified in [('bez-numeru-3', 80, True), ('bez-numeru-5', 124, True), ('bez-numeru-6', 180, True), ('bez-numeru-7', 220, True), ('bez-numeru-8', 269.5, True), ('18', 317.5, True)]:
    door(level, room_id, (686, y), (700, y), verified)
for y in (91, 147, 278):
    door(level, 'bez-numeru-9', (712, y), (700, y))
door(level, 'bez-numeru-10', (748, 356), (748, 362))
door(level, 'bez-numeru-11', (765, 363), (761, 363))
door(level, 'bez-numeru-12', (779, 384), (772, 384))
door(level, 'bez-numeru-14', (756, 405), (756, 401))
door(level, '10', (920, 507), (920, 522))
door(level, '10', (759, 452), (756, 452))
door(level, 'bez-numeru-20', (939, 517), (934, 517))
row(level, [
    ('bez-numeru-21', 755),
    ('bez-numeru-22', 796.5),
    ('bez-numeru-23', 825.5),
    ('bez-numeru-24', 862),
    ('bez-numeru-25', 898.5),
    ('bez-numeru-26', 927),
], 539, 522)
door(level, 'bez-numeru-27', (964, 537), (964, 532))
door(level, 'wc', (680, 555), (683, 555))
# Upper floor doors from actual gaps in floor plan.

level = 'pietro-1'
row(level, [
    ('101', 131),
    ('bez-numeru-1', 175),
    ('bez-numeru-2', 258),
    ('103', 384),
    ('bez-numeru-3', 407),
    ('104', 508),
    ('105', 609),
    ('106', 709),
], 86, 101)
row(level, [
    ('107', 814),
    ('108', 911),
], 111, 130)
door(level, '109', (934, 135), (930, 130))
door(level, 'wc', (675, 180.5), (685, 180.5))
door(level, 'bez-numeru-6', (778, 150), (778, 130))
door(level, '110', (858, 150), (858, 130))
door(level, 'bez-numeru-8', (938, 150), (930, 150))

level = 'pietro-2'
row(level, [
    ('201', 128),
    ('202', 252),
    ('203', 377),
    ('204', 502),
    ('205', 602),
    ('206', 702),
], 74.668421053, 92)
row(level, [
    ('207', 770.5),
    ('208', 870),
], 101, 120)
door(level, '209', (923, 120), (920, 120))
door(level, 'wc', (667, 167.5), (677, 167.5))
door(level, '211', (783.5, 139), (783.5, 120))
door(level, '210', (907.5, 139), (907.5, 120))
# Explicit internal passage between two rooms, not an automatic nearest-neighbor link.
join('pracownie', '02', (402, 122), 'bez-numeru-2', (405, 122), True)
join('niski-parter', 'bez-numeru-13', (936, 120), 'bez-numeru-14', (942, 120), False)
join('niski-parter', 'bez-numeru-14', (960, 146), 'bez-numeru-15', (960, 151), False)
join('niski-parter', 'bez-numeru-15', (971, 160), 'bez-numeru-16', (976, 160), True)
join('niski-parter', 'bez-numeru-16', (985, 169), 'bez-numeru-17', (985, 174), False)
join('parter', 'bez-numeru-20', (970, 510), 'bez-numeru-19', (970, 506), True)
join('parter', 'bez-numeru-17', (426, 438), '21', (431, 438), True)
join('pietro-2', '201', (141, 64), 'bez-numeru-1', (147, 64), True)
join('parter', 'bez-numeru-14', (775, 420), 'bez-numeru-13', (779, 420), True)
# Workshop annex stair and door connections.
lines['pracownie'] += [[(900, 220), (900, 270), (910, 270)]]
door('pracownie', 'bez-numeru-20', (915, 220), (900, 220))
door('pracownie', '051', (915, 270), (910, 270))
# Fix certain corridor stubs to align with explicit door points; no automatic joins.
lines['pracownie'] += [[(774, 148), (777, 148)], [(774, 148), (774, 141)], [(472, 268), (472, 277), (472, 285)]]
lines['pracownie'] += [[(600, 84), (600, 148)], [(472, 268), (386, 268)]]
door('pracownie', '021', (503, 212.5), (480, 212.5))
door('pracownie', 'teleinformatyczna', (761, 214), (774, 214))
door('pracownie', '024', (386, 270), (386, 268))


room_centers = {
    'pracownie-silownia': (704.5, 172),
    'pracownie-bez-numeru-15': (816, 222),
    'pietro-2-201': (128, 64),
    'pietro-2-bez-numeru-1': (157.5, 64),
    'pietro-2-wc': (641.5, 167.5),
    'parter-24': (135, 438),
    'parter-bez-numeru-3': (665.5, 80),
    'parter-bez-numeru-6': (665.5, 180),
    'parter-bez-numeru-10': (748, 332.5),
    'parter-bez-numeru-11': (796, 363),
    'parter-bez-numeru-12': (803, 384),
    'parter-bez-numeru-13': (803, 420),
    'parter-bez-numeru-14': (756, 420),
    'parter-bez-numeru-19': (970, 471.5),
    'parter-bez-numeru-20': (970, 517),
    'parter-wc': (654, 555),
}

door_bends = {
    ('pracownie', (788, 141)): (774, 141),
    ('pracownie', (470, 290)): (472, 290),
    ('pracownie', (475, 273)): (472, 273),
    ('niski-parter', (989, 169)): (989, 177),
    ('pietro-1', (934, 135)): (930, 135),
}


def orthogonal_room_segments(boundary, hub, portals, covers):
    """Enter at right angles to the door wall and join shared room segments."""
    groups = defaultdict(list)
    walls = list(zip(boundary, boundary[1:] + boundary[:1]))
    for x, y in portals:
        if (x, y) == hub:
            continue
        axes = sorted({0 if a[0] == b[0] else 1 for a, b in walls if on_wall((x, y), a, b)})
        for axis in axes:
            corner = (hub[0], y) if axis == 0 else (x, hub[1])
            if covers((x, y), corner) and covers(corner, hub):
                break
        else:
            raise ValueError(('no perpendicular room route', (x, y), hub))
        for a, b in [((x, y), corner), (corner, hub)]:
            if a == b:
                continue
            axis = 0 if a[1] == b[1] else 1
            groups[axis, a[1 - axis]].append(tuple(sorted((a[axis], b[axis]))))
    for (axis, fixed), intervals in groups.items():
        points = sorted({point for interval in intervals for point in interval})
        for start, end in zip(points, points[1:]):
            if any(low <= start < end <= high for low, high in intervals):
                if axis == 0:
                    yield (start, fixed), (end, fixed)
                else:
                    yield (fixed, start), (fixed, end)


def on_wall(point, start, end):
    return all(
        min(a, b) - WALL_TOLERANCE <= value <= max(a, b) + WALL_TOLERANCE
        for value, a, b in zip(point, start, end)
    )


def room_polygon(path_data):
    rings = [
        [(float(x), float(y)) for x, y in POINT_PATTERN.findall(part)]
        for part in path_data.split('Z')
        if 'M' in part
    ]
    return Polygon(rings[0], rings[1:])


def line_parts(geometry):
    if geometry.geom_type == 'LineString':
        yield geometry
        return
    for part in getattr(geometry, 'geoms', []):
        yield from line_parts(part)


class GraphBuilder:
    def __init__(self, rooms, levels):
        self.rooms = rooms
        self.rooms_by_id = {room['id']: room for room in rooms}
        self.polygons = {room['id']: room_polygon(room['d']) for room in rooms}
        self.nodes = {}
        self.edges = []
        self.nodes_by_position = {}
        self.edge_keys = set()
        self.projections = defaultdict(list)
        self.warnings = []
        self.doors = []
        self.places = []
        self.room_nodes = {}
        self.room_portals = defaultdict(set)
        self.room_interiors = {
            room['id']: self.polygons[room['id']].buffer(-0.15)
            for room in rooms if room['id'] not in WALKABLE_ROOMS
        }
        obstacles = {
            level: unary_union([
                self.room_interiors[room['id']]
                for room in rooms
                if room['level'] == level and room['id'] in self.room_interiors
            ])
            for level in levels
        }
        self.corridors = self.build_corridors(obstacles)

    def build_corridors(self, obstacles):
        corridors = {}
        for level, centerlines in lines.items():
            segments = []
            union = unary_union([LineString(points) for points in centerlines])
            for line in line_parts(union):
                for start, end in zip(line.coords, line.coords[1:]):
                    segment = LineString([start, end])
                    overlap = segment.intersection(obstacles[level]).length
                    if overlap > 0.2:
                        self.warnings.append(('corridor rejected', level, start, end, round(overlap, 2)))
                        continue
                    segments.append(segment)
            corridors[level] = segments
        return corridors

    def add_node(self, level, point, kind='corridor', name=None):
        x, y = (round(float(value), 3) for value in point)
        key = level, x, y
        if key not in self.nodes_by_position:
            node_id = 'n' + str(len(self.nodes))
            self.nodes_by_position[key] = node_id
            self.nodes[node_id] = {'level': level, 'x': x, 'y': y, 'kind': kind}
        else:
            node_id = self.nodes_by_position[key]

        if kind != 'corridor':
            self.nodes[node_id]['kind'] = kind
        if name:
            self.nodes[node_id]['name'] = name
        return node_id

    def position(self, node_id):
        node = self.nodes[node_id]
        return node['x'], node['y']

    def add_edge(self, start, end, kind='walk', verified=True, weight=None, room=None):
        if start == end:
            return
        key = tuple(sorted((start, end)))
        if key in self.edge_keys:
            return
        self.edge_keys.add(key)

        if weight is None:
            weight = math.dist(self.position(start), self.position(end))
        edge = {
            'a': start,
            'b': end,
            'weight': round(weight, 4),
            'kind': kind if verified else 'assumed',
            'physicalKind': kind,
        }
        if room:
            edge['room'] = room
        self.edges.append(edge)

    def attach(self, level, point, kind='corridor', name=None):
        """Attach a point only to the corridor segments it touches."""
        target = Point(point)
        touching = [
            (index, segment)
            for index, segment in enumerate(self.corridors[level])
            if segment.distance(target) < 0.015
        ]
        if not touching:
            self.warnings.append(('missing corridor attachment', level, point))
            return None

        node_id = self.add_node(level, point, kind, name)
        for index, segment in touching:
            self.projections[level, index].append((segment.project(target), node_id))
        return node_id

    def connect_corridors(self):
        for level, segments in self.corridors.items():
            for index, segment in enumerate(segments):
                positions = [
                    (0, self.add_node(level, segment.coords[0])),
                    (segment.length, self.add_node(level, segment.coords[-1])),
                    *self.projections[level, index],
                ]
                positions.sort()
                for (_, start), (_, end) in zip(positions, positions[1:]):
                    self.add_edge(start, end)

    def add_rooms(self):
        for room in self.rooms:
            room_id = room['id']
            polygon = self.polygons[room_id]
            if room_id == 'parter-pracownia-zawodowa':
                center = Point(120, 255)
            elif room_id in room_centers:
                center = Point(room_centers[room_id])
            else:
                center = polygon.centroid
                if not polygon.covers(center):
                    center = polygon.representative_point()

            node_id = self.add_node(room['level'], center.coords[0], 'room', room['name'])
            self.room_nodes[room_id] = node_id
            self.places.append({
                'id': room_id,
                'name': room['roomName'],
                'number': room['number'],
                'level': room['level'],
                'node': node_id,
                'displayName': room['displayName'],
                'named': bool(room['number'] or room['roomName']),
            })

    def add_portal(self, room_id, point):
        distance = self.polygons[room_id].boundary.distance(Point(point))
        if distance > 0.02:
            raise ValueError(('portal not on boundary', room_id, point, distance))
        level = self.rooms_by_id[room_id]['level']
        node_id = self.add_node(level, point, 'door')
        if self.room_nodes[room_id] != node_id:
            self.room_portals[room_id].add(node_id)
        return node_id

    def crossed_rooms(self, level, start, end, allowed_rooms=()):
        line = LineString([start, end])
        return [
            room['id'] for room in self.rooms
            if room['level'] == level
            and room['id'] in self.room_interiors
            and room['id'] not in allowed_rooms
            and line.intersection(self.room_interiors[room['id']]).length > 0.15
        ]

    def connect_doors(self):
        for level, specifications in door_specs.items():
            for suffix, wall_point, corridor_point, verified in specifications:
                room_id = level + '-' + suffix
                corridor = self.attach(level, corridor_point)
                bend = door_bends.get((level, wall_point), corridor_point)
                crossed = (
                    self.crossed_rooms(level, wall_point, bend)
                    or self.crossed_rooms(level, bend, corridor_point)
                )
                if corridor is None or crossed:
                    self.warnings.append(('door rejected', room_id, wall_point, corridor_point, crossed))
                    continue

                approach = self.add_node(level, bend)
                self.add_edge(corridor, approach)
                portal = self.add_portal(room_id, wall_point)
                self.add_edge(approach, portal, 'door', verified, room=room_id)
                self.doors.append({
                    'room': room_id, 'x': wall_point[0], 'y': wall_point[1], 'verified': verified,
                })

        for level, suffix_a, point_a, suffix_b, point_b, verified in room_joins:
            room_a = level + '-' + suffix_a
            room_b = level + '-' + suffix_b
            crossed = self.crossed_rooms(level, point_a, point_b)
            if crossed:
                self.warnings.append(('internal door rejected', room_a, room_b, crossed))
                continue

            portal_a = self.add_portal(room_a, point_a)
            portal_b = self.add_portal(room_b, point_b)
            self.add_edge(portal_a, portal_b, 'door', verified, room=room_a + ' / ' + room_b)
            for room_id, point in ((room_a, point_a), (room_b, point_b)):
                self.doors.append({'room': room_id, 'x': point[0], 'y': point[1], 'verified': verified})

    def connect_room_interiors(self):
        for room_id, portals in self.room_portals.items():
            level = self.rooms_by_id[room_id]['level']
            polygon = self.polygons[room_id]
            boundary = list(polygon.exterior.coords)[:-1]
            padded = polygon.buffer(0.01)

            def covers(start, end):
                return start == end or padded.covers(LineString([start, end]))

            hub = self.position(self.room_nodes[room_id])
            portal_positions = sorted(map(self.position, portals))
            for start, end in orthogonal_room_segments(boundary, hub, portal_positions, covers):
                self.add_edge(self.add_node(level, start), self.add_node(level, end), 'inside', room=room_id)

    def validate_edges(self):
        """Reject any same-floor segment that crosses an unrelated room."""
        for edge in self.edges:
            start, end = edge['a'], edge['b']
            level = self.nodes[start]['level']
            if level != self.nodes[end]['level']:
                continue
            allowed_rooms = edge.get('room', '').split(' / ') if edge['physicalKind'] == 'inside' else []
            start_point, end_point = self.position(start), self.position(end)
            crossed = self.crossed_rooms(level, start_point, end_point, allowed_rooms)
            if crossed:
                raise ValueError(('edge crosses room', edge, start_point, end_point, crossed))

    def reachable(self, start, allow_assumed):
        neighbors = defaultdict(list)
        for edge in self.edges:
            if allow_assumed or edge['kind'] != 'assumed':
                neighbors[edge['a']].append(edge['b'])
                neighbors[edge['b']].append(edge['a'])

        visited = set()
        pending = [start]
        while pending:
            current = pending.pop()
            if current in visited:
                continue
            visited.add(current)
            pending.extend(neighbors[current])
        return visited


# Stair landings are exact corridor attachments, in floor order from bottom to top.
STAIR_LANDINGS = {
    'niski-parter': [(133, 169), (655, 158)],
    'parter': [(133, 530), (653, 515)],
    'pietro-1': [(130, 147), (654, 133)],
    'pietro-2': [(127, 133), (647, 120)],
}
STAIR_BOUNDS = {
    'niski-parter': [(119, 143, 146, 195), (629, 142, 682, 173)],
    'parter': [(120, 506, 146, 552), (628, 499, 679, 530)],
    'pietro-1': [(118, 117, 144, 169), (625, 118, 675, 147)],
    'pietro-2': [(114, 105.505263158, 140, 157), (617, 107, 667, 134)],
}
STAIRS = [
    ('A', 'Schody zachodnie', 45),
    ('B', 'Schody centralne', 38),
]


def connect_stairs(builder):
    floor_order = list(STAIR_LANDINGS)
    anchors = {}
    for level, points in STAIR_LANDINGS.items():
        for index, point in enumerate(points):
            _, name, _ = STAIRS[index]
            anchors[level, index] = builder.attach(level, point, 'stairs', name)

    stairwells = {}
    for index, (stair_id, name, weight) in enumerate(STAIRS):
        landings = {}
        stairwells[stair_id] = {'name': name, 'landings': landings}
        for level in floor_order:
            node_id = anchors[level, index]
            builder.nodes[node_id].update(stairId=stair_id, name=stair_id + ' · ' + name)
            landings[level] = {'node': node_id, 'bounds': STAIR_BOUNDS[level][index]}
        for lower, upper in zip(floor_order, floor_order[1:]):
            builder.add_edge(anchors[lower, index], anchors[upper, index], 'stairs', weight=weight)
            builder.edges[-1].update(stairId=stair_id, lower=lower, upper=upper)
    return stairwells


def add_main_entrance(builder):
    entrance = builder.attach('parter', (708, 615), 'entrance', 'Wejście główne')
    builder.places.insert(0, {
        'id': 'wejscie',
        'name': 'Wejście główne',
        'number': None,
        'level': 'parter',
        'node': entrance,
        'displayName': 'Wejście główne',
        'named': True,
    })
    return entrance


def connect_workshop_annex(builder):
    exit_node = builder.attach('pracownie', (774, 350))
    stair = builder.attach('pracownie', (900, 270))
    turns = [builder.add_node('pracownie', point) for point in [(786, 350), (786, 380), (900, 380)]]
    path = [exit_node, *turns, stair]
    for start, end in zip(path, path[1:]):
        if builder.crossed_rooms('pracownie', builder.position(start), builder.position(end)):
            raise ValueError('annex approach crosses a room')
        builder.add_edge(start, end)


def connect_workshop_door(builder):
    name = 'drzwi między parterem a pracowniami'
    ground = builder.attach('parter', (225, 255), 'transfer', 'D · ' + name)
    workshop = builder.add_node('pracownie', (210, 284), 'transfer', 'D · ' + name)
    approach = builder.attach('pracownie', (209, 245))
    for landing in (ground, workshop):
        builder.nodes[landing]['transferId'] = 'D'
    builder.add_edge(approach, workshop)
    builder.add_edge(ground, workshop, 'transfer', weight=1)
    builder.edges[-1].update(transferId='D', transferName=name)


def connect_low_ground_passage(builder):
    passage_ends = []
    for level, corridor, endpoint in [
        ('pracownie', (70, 245), (-24, 245)),
        ('niski-parter', (133, 80), (133, -35)),
    ]:
        approach = builder.nodes_by_position[level, *corridor]
        landing = builder.add_node(level, endpoint, 'transfer', 'P · Łącznik z pracowniami')
        builder.nodes[landing]['transferId'] = 'P'
        builder.add_edge(approach, landing)
        passage_ends.append(landing)
    builder.add_edge(*passage_ends, kind='transfer', weight=1)
    builder.edges[-1]['transferId'] = 'P'


def connect_room_25_approach(builder, entrance):
    name = 'dojście do sali 25'
    ground = builder.add_node('parter', (1010, 580), 'transfer', 'E · ' + name)
    low_ground = builder.add_node('niski-parter', (999.5, 193.5), 'transfer', 'E · ' + name)
    for landing in (ground, low_ground):
        builder.nodes[landing]['transferId'] = 'E'

    ground_path = [
        entrance,
        builder.add_node('parter', (708, 647)),
        builder.add_node('parter', (1010, 647)),
        ground,
    ]
    low_ground_path = [
        low_ground,
        builder.add_node('niski-parter', (999.5, 185)),
        builder.nodes_by_position['niski-parter', 990, 185],
    ]
    for path in (ground_path, low_ground_path):
        for start, end in zip(path, path[1:]):
            builder.add_edge(start, end)
    builder.add_edge(ground, low_ground, kind='transfer', weight=1)
    builder.edges[-1].update(transferId='E', transferName=name)


def report_access(builder, entrance):
    confirmed = builder.reachable(entrance, allow_assumed=False)
    including_assumed = builder.reachable(entrance, allow_assumed=True)
    for place in builder.places:
        node_id = place['node']
        if node_id in confirmed:
            place['access'] = 'confirmed'
        elif node_id in including_assumed:
            place['access'] = 'uncertain'
        else:
            place['access'] = 'unmapped'

    print('warnings', *builder.warnings, sep='\n')
    print('reachable', len(confirmed), len(including_assumed),
          'nodes', len(builder.nodes), 'edges', len(builder.edges))
    print('unmapped', [place['id'] for place in builder.places if place['access'] == 'unmapped'])
    print('uncertain', [place['id'] for place in builder.places if place['access'] == 'uncertain'])
    print('confirmed', sum(place['access'] == 'confirmed' for place in builder.places))


def main():
    rooms = json.loads((ROOT / 'pomieszczenia.json').read_text(encoding='utf-8'))
    graph_file = ROOT / 'graf.json'
    levels = json.loads(graph_file.read_text(encoding='utf-8'))['levels']

    builder = GraphBuilder(rooms, levels)
    builder.add_rooms()
    builder.connect_doors()
    stairwells = connect_stairs(builder)
    entrance = add_main_entrance(builder)

    # These two approaches must attach before corridor segments are split into edges.
    connect_workshop_annex(builder)
    connect_workshop_door(builder)
    builder.connect_corridors()

    connect_low_ground_passage(builder)
    connect_room_25_approach(builder, entrance)
    # Direct approach through the doorway on the edge of the court.
    builder.add_edge(
        builder.nodes_by_position['parter', 637, 370],
        builder.nodes_by_position['parter', 290, 255],
    )
    builder.connect_room_interiors()
    builder.validate_edges()
    report_access(builder, entrance)

    graph = {
        'levels': levels,
        'nodes': builder.nodes,
        'edges': builder.edges,
        'places': builder.places,
        'start': 'wejscie',
        'doors': builder.doors,
        'notes': {
            'stairs': 'Zgodność klatek na poziomach wynika z położenia na rysunku; długości 45/38 są szacunkowe.',
            'assumed': 'Przejścia niejednoznaczne na planie, domyślnie wyłączone.',
            'access': 'confirmed oznacza zgodność z widocznym układem rysunku, nie weryfikację w budynku.',
            'transfer': 'P prowadzi z niskiego parteru do pracowni, D łączy parter z pracowniami, a E prowadzi na zewnątrz do sali 25.',
        },
        'stairwells': stairwells,
        'floorOrder': list(STAIR_LANDINGS),
    }
    graph_file.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
