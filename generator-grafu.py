import json,re,math,shutil,zipfile
from pathlib import Path
from collections import defaultdict
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
out=Path(__file__).resolve().parent; src=out # requires shapely; regenerates graf.json only
rooms=json.loads((out/'pomieszczenia.json').read_text(encoding='utf-8')); old=json.loads((out/'graf.json').read_text(encoding='utf-8')); L=old['levels']; R={r['id']:r for r in rooms}; polys={}
for r in rooms:
 rings=[[(float(x),float(y)) for x,y in re.findall(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)',p)] for p in r['d'].split('Z') if 'M' in p];polys[r['id']]=Polygon(rings[0],rings[1:])
walkable={'parter-pracownia-zawodowa'}
# Explicit centerlines. No generic horizontal line between workshop rooms: there is no hallway there.
# The central stair is entered from the east-side corridor on all four levels.
lines={
'pracownie': [[(70,245),(209,245),(220,230),(220,148),(774,148)],[(220,230),(220,276),(240,276)],[(460,148),(480,148),(480,260),(472,268),(472,285)],[(600,148),(600,283),(646,283)],[(774,148),(774,350)],[(774,205),(784,205)],[(774,239.5),(784,239.5)]],
'niski-parter': [[(118,80),(133,80),(133,125),(730,125)],[(133,125),(133,169)],[(695,158),(655,158)],[(695,125),(695,171),(695,197),(685,197),(685,205)],[(695,197),(695,205)],[(730,125),(736,125),(736,230)],[(990,177),(990,230)]],
'parter': [[(708,615),(708,483),(133,483),(133,530)],[(708,515),(653,515)],[(708,483),(708,430),(708,355),(700,355),(700,52)],[(708,522),(746,522),(746,452),(756,452)],[(746,522),(934,522),(934,532),(964,532)],[(934,522),(934,517)],[(708,555),(683,555)],[(708,370),(733,375),(748,369),(748,362)],[(748,369),(761,363)],[(733,375),(772,384)],[(708,392),(756,401)],[(700,52),(651,52)],[(290,255),(120,255)],[(637,370),(650,370),(708,370)]],
'pietro-1': [[(130,147),(130,101),(709,101),(709,130)],[(685,130),(709,130),(930,130)],[(685,133),(654,133)],[(685,101),(685,180.5)],[(930,130),(930,150)]],
'pietro-2': [[(127,133),(127,92),(702,92),(702,120)],[(677,120),(702,120),(920,120)],[(677,120),(647,120)],[(677,92),(677,167.5)]]}
# Manual doorway declarations: id, point on room boundary, corridor attachment, confidence.
# These are mapped to source openings; coordinates are approximate in the traced SVG.
D=defaultdict(list)
def door(l,r,p,q,ok=True):D[l].append((r,p,q,ok))
def row(l,rs,y,cy):
 for r,x,*flag in rs:door(l,r,(x,y),(x,cy),not flag or flag[0])
# Workshop upper/lower rooms: no corridor along common wall between rows.
l='pracownie';row(l,[('bez-numeru-1',293),('02',352),('bez-numeru-3',439),('wc-1',465),('wc-1',518),('bez-numeru-4',570),('bez-numeru-6',684),('bez-numeru-7',719),('bez-numeru-7',745),('bez-numeru-10',777)],137,148)
door(l,'bez-numeru-5',(631,119),(631,148));door(l,'09',(788,141),(774,141),False) # adjust attachment below
# 09 has opening along its west side near y148, corridor starts y148; route via shared upper aisle
D[l][-1]=('09',(788,141),(774,148),True)
for r,y,ok in [('09a',156,True),('bez-numeru-15',216,True),('bez-numeru-15',229,True),('bez-numeru-18',263,True),('012',323,True)]:door(l,r,(788,y),(774,y),ok)
for r,x in [('bez-numeru-11',68),('bez-numeru-12',167)]:door(l,r,(x,229),(x,245),True if x!=68 else True)
# left corridor ends at x70; first door near x66
D[l][-2]=('bez-numeru-11',(76,229),(76,245),True)
row(l,[('029',284),('028',320),('026',450),('silownia',666)],159,148)
door(l,'bez-numeru-13',(452,247),(480,247),True);door(l,'silownia',(630,159),(630,148),True)
door(l,'pracownia-zawodowa',(243,276),(240,276));door(l,'biblioteka',(470,290),(472,285));door(l,'sala-konferencyjna',(475,273),(472,268));door(l,'informatyczna-1',(585,279),(600,279));door(l,'robotyka',(600,296),(600,283));door(l,'informatyczna-2',(648,283),(646,283));door(l,'informatyczna-3',(761,286),(774,286))
# The corridor stub from x480 to x472 is diagonal. Attach at the explicit bend.
# Low ground
l='niski-parter';door(l,'01',(115,80),(118,80))
row(l,[('032',255),('032',382),('033',454),('034',485),('035',508),('036',548),('037',594),('038',640),('039',672),('040',712)],109,125)
lines[l].append([(695,151),(719.5,151)])
door(l,'wc',(682,197),(685,197));door(l,'041',(719.5,160),(719.5,151));door(l,'042',(695,207),(695,205));door(l,'bez-numeru-13',(739,125),(736,125),False)
door(l,'bez-numeru-17',(988,185),(990,185));door(l,'bez-numeru-16',(989,169),(990,177),False)
# Ground floor. Each bottom-row room uses its own visible doorway into lower corridor.
l='parter';row(l,[('24',135),('bez-numeru-15',176.5),('22',252),('bez-numeru-17',328.5),('bez-numeru-17',390),('20',531),('19',632)],466,483)
for r,y,ok in [('bez-numeru-3',80,True),('bez-numeru-5',124,True),('bez-numeru-6',180,True),('bez-numeru-7',220,True),('bez-numeru-8',269.5,True),('18',317.5,True)]:door(l,r,(686,y),(700,y),ok)
for y in (91, 147, 278):
 door(l,'bez-numeru-9',(712,y),(700,y))
door(l,'bez-numeru-10',(748,356),(748,362));door(l,'bez-numeru-11',(765,363),(761,363));door(l,'bez-numeru-12',(779,384),(772,384));door(l,'bez-numeru-14',(756,405),(756,401))
door(l,'10',(920,507),(920,522));door(l,'10',(759,452),(756,452));door(l,'bez-numeru-20',(939,517),(934,517));row(l,[('bez-numeru-21',755),('bez-numeru-22',796.5),('bez-numeru-23',825.5),('bez-numeru-24',862),('bez-numeru-25',898.5),('bez-numeru-26',927)],539,522)
door(l,'bez-numeru-27',(964,537),(964,532))
door(l,'wc',(680,555),(683,555))
# Upper floor doors from actual gaps in floor plan.
l='pietro-1';row(l,[('101',131),('bez-numeru-1',175),('bez-numeru-2',258),('103',384),('bez-numeru-3',407),('104',508),('105',609),('106',709)],86,101);row(l,[('107',814),('108',911)],111,130);door(l,'109',(934,135),(930,130));door(l,'wc',(675,180.5),(685,180.5));door(l,'bez-numeru-6',(778,150),(778,130));door(l,'110',(858,150),(858,130));door(l,'bez-numeru-8',(938,150),(930,150))
l='pietro-2';row(l,[('201',128),('202',252),('203',377),('204',502),('205',602),('206',702)],74.668421053,92);row(l,[('207',770.5),('208',870)],101,120);door(l,'209',(923,120),(920,120));door(l,'wc',(667,167.5),(677,167.5));door(l,'211',(783.5,139),(783.5,120));door(l,'210',(907.5,139),(907.5,120))
# Explicit internal passage between two rooms, not an automatic nearest-neighbor link.
J=[]
def join(l,a,pa,b,pb,ok=True):J.append((l,a,pa,b,pb,ok))
join('pracownie','02',(402,122),'bez-numeru-2',(405,122),True)
join('niski-parter','bez-numeru-13',(936,120),'bez-numeru-14',(942,120),False)
join('niski-parter','bez-numeru-14',(960,146),'bez-numeru-15',(960,151),False)
join('niski-parter','bez-numeru-15',(971,160),'bez-numeru-16',(976,160),True)
join('niski-parter','bez-numeru-16',(985,169),'bez-numeru-17',(985,174),False)
join('parter','bez-numeru-20',(970,510),'bez-numeru-19',(970,506),True)
join('parter','bez-numeru-17',(426,438),'21',(431,438),True)
join('pietro-2','201',(141,64),'bez-numeru-1',(147,64),True)
join('parter','bez-numeru-14',(775,420),'bez-numeru-13',(779,420),True)
# Workshop annex stair and door connections.
lines['pracownie'] += [[(900,220),(900,270),(910,270)]]
door('pracownie','bez-numeru-20',(915,220),(900,220));door('pracownie','051',(915,270),(910,270))
# Fix certain corridor stubs to align with explicit door points; no automatic joins.
lines['pracownie'] += [[(774,148),(777,148)],[(774,148),(774,141)],[(472,268),(472,277),(472,285)]]
lines['pracownie'] += [[(600,84),(600,148)],[(472,268),(386,268)]]
door('pracownie','021',(503,212.5),(480,212.5));door('pracownie','teleinformatyczna',(761,214),(774,214));door('pracownie','024',(386,270),(386,268))
# Remove accidental intersection of the outdoor spine with walls: it stays inside outdoor zones.
N={};E=[];lookup={};Ekeys=set(); road={}; projections=defaultdict(list); warnings=[]; doors=[]
obs={l:unary_union([polys[r['id']].buffer(-.15) for r in rooms if r['level']==l and r['id'] not in walkable]) for l in L}
def node(l,p,kind='corridor',name=None):
 x,y=[round(float(v),3) for v in p];key=(l,x,y)
 if key not in lookup:
  n='n'+str(len(N));lookup[key]=n;N[n]={'level':l,'x':x,'y':y,'kind':kind}
 else:n=lookup[key]
 if kind!='corridor':N[n]['kind']=kind
 if name:N[n]['name']=name
 return n
def xy(n):return N[n]['x'],N[n]['y']
def add(a,b,kind='walk',ok=True,weight=None,room=None):
 if a==b:return
 key=tuple(sorted((a,b)))
 if key in Ekeys:return
 Ekeys.add(key); w=weight if weight is not None else math.dist(xy(a),xy(b));e={'a':a,'b':b,'weight':round(w,4),'kind':kind if ok else 'assumed','physicalKind':kind}
 if room:e['room']=room
 E.append(e)
def parts(g):
 if g.geom_type=='LineString':return [g]
 return [q for p in getattr(g,'geoms',[]) for q in parts(p)]
for l,ls in lines.items():
 # strict corridor validation. Do not clip through a room and reconnect on the other side.
 ss=[]
 for line in parts(unary_union([LineString(x) for x in ls])):
  for a,b in zip(line.coords,list(line.coords)[1:]):
   s=LineString([a,b]);cross=s.intersection(obs[l]).length
   if cross>.2: warnings.append(('corridor rejected',l,a,b,round(cross,2)));continue
   ss.append(s)
 road[l]=ss
# Attachment may only be a specified point on a designated corridor, never a nearest room.
def attach(l,p,kind='corridor',name=None):
 q=Point(p); near=[(i,s) for i,s in enumerate(road[l]) if s.distance(q)<.015]
 if not near: warnings.append(('missing corridor attachment',l,p));return None
 n=node(l,p,kind,name)
 for i,s in near:projections[l,i].append((s.project(q),n))
 return n
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
places=[]; hub={}
for r in rooms:
 id=r['id'];p=polys[id];c=p.centroid if p.covers(p.centroid) else p.representative_point();
 if id=='parter-pracownia-zawodowa':c=Point(120,255)
 if id in room_centers:c=Point(room_centers[id])
 n=node(r['level'],c.coords[0],'room',r['name']);hub[id]=n
 places.append({
     'id': id, 'name': r['roomName'], 'number': r['number'], 'level': r['level'],
     'node': n, 'displayName': r['displayName'], 'named': bool(r['number'] or r['roomName']),
 })
# Connect each door to its room hub by a path wholly inside the room polygon (including nonconvex rooms).
orthogonal_portals = defaultdict(set)

def on_wall(point, a, b):
    return (min(a[0], b[0]) <= point[0] <= max(a[0], b[0])
            and min(a[1], b[1]) <= point[1] <= max(a[1], b[1]))

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
            groups[axis, a[1-axis]].append(tuple(sorted((a[axis], b[axis]))))
    for (axis, fixed), intervals in groups.items():
        points = sorted({point for interval in intervals for point in interval})
        for start, end in zip(points, points[1:]):
            if any(low <= start < end <= high for low, high in intervals):
                if axis == 0:
                    yield (start, fixed), (end, fixed)
                else:
                    yield (fixed, start), (fixed, end)

def interior(id,n):
 if hub[id]!=n:orthogonal_portals[id].add(n)
def portal(id,p):
 poly=polys[id];q=Point(p)
 if poly.boundary.distance(q)>.02:raise ValueError(('portal not on boundary',id,p,poly.boundary.distance(q)))
 n=node(R[id]['level'],p,'door');interior(id,n);return n
def valid_link(l,a,b,allow=()):
 line=LineString([a,b]);cross=[r['id'] for r in rooms if r['level']==l and r['id'] not in walkable and r['id'] not in allow and line.intersection(polys[r['id']].buffer(-.15)).length>.15];return cross
door_bends = {
    ('pracownie', (788, 141)): (774, 141),
    ('pracownie', (470, 290)): (472, 290),
    ('pracownie', (475, 273)): (472, 273),
    ('niski-parter', (989, 169)): (989, 177),
    ('pietro-1', (934, 135)): (930, 135),
}
for l,ds in D.items():
 for r,p,q,ok in ds:
  id=l+'-'+r; a=attach(l,q)
  bend=door_bends.get((l,p),q)
  cross=valid_link(l,p,bend) or valid_link(l,bend,q)
  if a is None or cross:warnings.append(('door rejected',id,p,q,cross));continue
  approach=node(l,bend);add(a,approach)
  b=portal(id,p);add(approach,b,'door',ok,room=id);doors.append({'room':id,'x':p[0],'y':p[1],'verified':ok})
for l,r,p,s,q,ok in J:
 a=l+'-'+r;b=l+'-'+s;cross=valid_link(l,p,q)
 if cross:warnings.append(('internal door rejected',a,b,cross));continue
 n=portal(a,p);m=portal(b,q);add(n,m,'door',ok,room=a+' / '+b);doors.extend([{'room':id,'x':v[0],'y':v[1],'verified':ok} for id,v in [(a,p),(b,q)]])
# Explicit stair landings (no projection to a nearby corridor). Floor correspondence inferred from aligned landings.
S={ 'niski-parter':[(133,169),(655,158)],'parter':[(133,530),(653,515)],'pietro-1':[(130,147),(654,133)],'pietro-2':[(127,133),(647,120)]}
anchors={}
for l,ps in S.items():
 for i,p in enumerate(ps):anchors[l,i]=attach(l,p,'stairs','Schody '+('zachodnie' if i==0 else 'centralne'))
stairwells={}
BOUNDS={'niski-parter': [(119, 143, 146, 195), (629, 142, 682, 173)], 'parter': [(120, 506, 146, 552), (628, 499, 679, 530)], 'pietro-1': [(118, 117, 144, 169), (625, 118, 675, 147)], 'pietro-2': [(114, 105.505263158, 140, 157), (617, 107, 667, 134)]}
for i,sid in enumerate(('A','B')):
 name='Schody '+('zachodnie' if i==0 else 'centralne')
 stairwells[sid]={'name':name,'landings':{}}
 for l in S:
  nid=anchors[l,i];N[nid].update(stairId=sid,name=sid+' · '+name);stairwells[sid]['landings'][l]={'node':nid,'bounds':BOUNDS[l][i]}
 for a,b in zip(S,list(S)[1:]):
  add(anchors[a,i],anchors[b,i],'stairs',weight=45 if i==0 else 38)
  E[-1].update(stairId=sid,lower=a,upper=b)
start=attach('parter',(708,615),'entrance','Wejście główne');places.insert(0,{
    'id': 'wejscie', 'name': 'Wejście główne', 'number': None, 'level': 'parter',
    'node': start, 'displayName': 'Wejście główne', 'named': True,
})
# Outdoor approach from the south exit to the annex stair, as marked on the workshop plan.
annex_exit = attach('pracownie', (774, 350))
annex_stair = attach('pracownie', (900, 270))
annex_turns = [node('pracownie', p) for p in [(786, 350), (786, 380), (900, 380)]]
annex_path = [annex_exit, *annex_turns, annex_stair]
for a, b in zip(annex_path, annex_path[1:]):
    if valid_link('pracownie', xy(a), xy(b)):
        raise ValueError('annex approach crosses a room')
    add(a, b, 'walk')
# The door marked on both plans connects the ground-floor courtyard to the workshop corridor.
door_name = 'drzwi między parterem a pracowniami'
ground_door = attach('parter', (225, 255), 'transfer', 'D · '+door_name)
workshop_door = node('pracownie', (210, 284), 'transfer', 'D · '+door_name)
workshop_approach = attach('pracownie', (209, 245))
for landing in (ground_door, workshop_door):
    N[landing]['transferId'] = 'D'
add(workshop_approach, workshop_door)
add(ground_door, workshop_door, kind='transfer', weight=1)
E[-1].update(transferId='D', transferName=door_name)
for l,ss in road.items():
 for i,s in enumerate(ss):
  pts=[(0,node(l,s.coords[0])),(s.length,node(l,s.coords[-1]))]+projections[l,i];pts.sort()
  for (_,a),(_,b) in zip(pts,pts[1:]):add(a,b)
# User-marked connector. Each plan shows its own approach to the same passage.
passage_ends = []
for level, corridor, endpoint in [
    ('pracownie', (70, 245), (-24, 245)),
    ('niski-parter', (133, 80), (133, -35)),
]:
    approach = lookup[level, *corridor]
    landing = node(level, endpoint, 'transfer', 'P · Łącznik z pracowniami')
    N[landing]['transferId'] = 'P'
    add(approach, landing)
    passage_ends.append(landing)
add(*passage_ends, kind='transfer', weight=1)
E[-1]['transferId'] = 'P'
# Exterior approach from the main entrance to the stair next to room 25.
room25_transfer_name = 'dojście do sali 25'
room25_ground = node('parter', (1010, 580), 'transfer', 'E · '+room25_transfer_name)
room25_low = node('niski-parter', (999.5, 193.5), 'transfer', 'E · '+room25_transfer_name)
for landing in (room25_ground, room25_low):
    N[landing]['transferId'] = 'E'
ground_path = [start, node('parter', (708, 647)), node('parter', (1010, 647)), room25_ground]
low_path = [room25_low, node('niski-parter', (999.5, 185)), lookup['niski-parter', 990, 185]]
for path in (ground_path, low_path):
    for a, b in zip(path, path[1:]):
        add(a, b)
add(room25_ground, room25_low, kind='transfer', weight=1)
E[-1].update(transferId='E', transferName=room25_transfer_name)
# Keep a direct approach through the doorway on the edge of the court.
add(lookup['parter', 637, 370], lookup['parter', 290, 255])
for room, portals in orthogonal_portals.items():
    level = R[room]['level']
    polygon = polys[room]
    boundary = list(polygon.exterior.coords)[:-1]
    padded = polygon.buffer(.01)
    def covers(a, b):
        return a == b or padded.covers(LineString([a, b]))
    for a, b in orthogonal_room_segments(boundary, xy(hub[room]), sorted(map(xy, portals)), covers):
        add(node(level, a), node(level, b), 'inside', room=room)
# Validate every segment against unrelated room interiors; same-level optional links cannot cross walls of unrelated rooms either.
for e in E:
 a,b=e['a'],e['b'];l=N[a]['level'];
 if l!=N[b]['level']:continue
 allow=e.get('room','').split(' / ') if e['physicalKind']=='inside' else []
 cross=valid_link(l,xy(a),xy(b),allow)
 if cross:raise ValueError(('edge crosses room',e,xy(a),xy(b),cross))
def reached(allow):
 adj=defaultdict(list)
 for e in E:
  if allow or e['kind']!='assumed':adj[e['a']].append(e['b']);adj[e['b']].append(e['a'])
 seen=set();q=[start]
 while q:
  u=q.pop()
  if u in seen:continue
  seen.add(u);q+=adj[u]
 return seen
s0,s1=reached(False),reached(True)
for p in places:p['access']='confirmed' if p['node'] in s0 else 'uncertain' if p['node'] in s1 else 'unmapped'

print('warnings',*warnings,sep='\n');print('reachable',len(s0),len(s1),'nodes',len(N),'edges',len(E));print('unmapped',[p['id'] for p in places if p['access']=='unmapped']);print('uncertain',[p['id'] for p in places if p['access']=='uncertain']);print('confirmed',sum(p['access']=='confirmed' for p in places))
graph={'levels':L,'nodes':N,'edges':E,'places':places,'start':'wejscie','doors':doors,'notes':{'stairs':'Zgodność klatek na poziomach wynika z położenia na rysunku; długości 45/38 są szacunkowe.','assumed':'Przejścia niejednoznaczne na planie, domyślnie wyłączone.','access':'confirmed oznacza zgodność z widocznym układem rysunku, nie weryfikację w budynku.'}}
graph.update(stairwells=stairwells,floorOrder=list(S))
graph['notes']['transfer'] = 'P prowadzi z niskiego parteru do pracowni, D łączy parter z pracowniami, a E prowadzi na zewnątrz do sali 25.'
(out/'graf.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2), encoding='utf-8')
