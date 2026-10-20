"""Reproducible Canal Town kit. Run inside Blender, or through Blender MCP.

Canonical authoring: x/z in [-.5,.5], y up. Blender coordinates are (x,-z,y),
so glTF's Y-up export restores canonical coordinates. Faces 0..3 follow the
quad perimeter: z=-.5, x=.5, z=.5, x=-.5. Metadata is shared with the solver.
"""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(globals()['CANAL_ROOT']) if 'CANAL_ROOT' in globals() else Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/canal-town'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'art/canal-town'
catalog = json.loads((SOURCE / 'catalog.json').read_text())
library_scene=bpy.data.scenes.get('Canal Kit Library') or bpy.data.scenes.new('Canal Kit Library')
bpy.context.window.scene=library_scene
gallery_collection=bpy.data.collections.get('Canal Kit Gallery')
if gallery_collection:
    for obj in list(gallery_collection.objects): bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(gallery_collection)
old_gallery=bpy.data.scenes.get('Canal Kit Gallery')
if old_gallery: bpy.data.scenes.remove(old_gallery)
previous=bpy.data.collections.get('Canal Town Kit')
if previous:
    old_meshes=set(o.data for o in previous.objects if o.type=='MESH')
    for obj in list(previous.objects): bpy.data.objects.remove(obj,do_unlink=True)
    for mesh in old_meshes:
        if mesh.users==0: bpy.data.meshes.remove(mesh)
    bpy.data.collections.remove(previous)
for old in list(bpy.data.materials):
    if old.users==0: bpy.data.materials.remove(old)
collection = bpy.data.collections.new('Canal Town Kit')
bpy.context.scene.collection.children.link(collection)

def material(name, color, roughness=.8, glow=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = 2
    return m

def rgb(value):
    value=value.lstrip('#')
    return tuple(((int(value[i:i+2],16)/255+.055)/1.055)**2.4 if int(value[i:i+2],16)/255>.04045 else int(value[i:i+2],16)/255/12.92 for i in (0,2,4))

mats = [material('Ivory plaster', rgb('#f0ddb4')), material('Ochre plaster', rgb('#ead3a9')),
        material('Dark cedar', rgb('#665044')), material('Cedar cut edges', rgb('#a47b59')),
        material('Blue ceramic', rgb('#486d85'), .72), material('Ceramic ridges', rgb('#567a90'), .76),
        material('Weathered stone', rgb('#bdb9a2')), material('Willow leaves', rgb('#6e9e6b')),
        material('Lantern paper', rgb('#ffcc7e'), .7, True), material('Indigo cloth', rgb('#47788a')),
        material('Blossom', rgb('#e6a0ad')), material('Marigold', rgb('#e7b857')),
        material('Leaf tips', rgb('#a6bd7a')), material('Leaf shade', rgb('#527a59')),
        material('Ironwork', rgb('#455a60')), material('Roof underside', rgb('#394d59')),
        material('Window glass', rgb('#405d61'), .42), material('Warm window', rgb('#e8b96d'), .7, True),
        material('Pale paving', rgb('#d4cbb3')), material('Warm paving', rgb('#c9bda3')),
        material('Terracotta', rgb('#bf7860')), material('Paper sign', rgb('#eddfbc'))]

class Model:
    def __init__(self): self.vertices=[]; self.faces=[]; self.materials=[]
    def poly(self, points, mat):
        # Tessellate sloped ceramic surfaces before bilinear deformation, so
        # applied tile courses follow the same surface on irregular quads.
        if mat==4 and len(points)==3:
            a,b,c=[Vector(p) for p in points]; steps=5
            def point(i,j): return a+(b-a)*(i/steps)+(c-a)*(j/steps)
            for i in range(steps):
                for j in range(steps-i):
                    self.raw_poly([point(i,j),point(i+1,j),point(i,j+1)],mat)
                    if i+j<steps-1: self.raw_poly([point(i+1,j),point(i+1,j+1),point(i,j+1)],mat)
        else: self.raw_poly(points,mat)
    def raw_poly(self,points,mat):
        start=len(self.vertices); self.vertices.extend([tuple(p) for p in points]); self.faces.append(tuple(range(start,start+len(points)))); self.materials.append(mat)
    def box(self, center, scale, mat):
        x,y,z=center; a,b,c=[v/2 for v in scale]
        p=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),(x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
        for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]: self.poly([p[i] for i in face],mat)
    def beam(self, start, end, width, mat):
        a,b=Vector(start),Vector(end); direction=(b-a).normalized(); axis=Vector((0,1,0)) if abs(direction.y)<.9 else Vector((1,0,0)); u=direction.cross(axis).normalized()*width/2; v=direction.cross(u).normalized()*width/2
        p=[a-u-v,a+u-v,a+u+v,a-u+v,b-u-v,b+u-v,b+u+v,b-u+v]
        for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]: self.poly([p[i] for i in face],mat)
    def ellipsoid(self, center, scale, mat, segments=9, rings=6):
        cx,cy,cz=center; sx,sy,sz=scale
        for r in range(rings):
            for s in range(segments):
                points=[]
                for rr,ss in [(r,s),(r,s+1),(r+1,s+1),(r+1,s)]:
                    t=math.pi*rr/rings; p=2*math.pi*ss/segments
                    points.append((cx+math.sin(t)*math.cos(p)*sx,cy+math.cos(t)*sy,cz+math.sin(t)*math.sin(p)*sz))
                self.poly(points,mat)
    def finish(self, name, metadata=None):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(x,-z,y) for x,y,z in self.vertices],[],self.faces)
        mesh.update()
        for m in mats: mesh.materials.append(m)
        for p,idx in zip(mesh.polygons,self.materials): p.material_index=idx
        uv=mesh.uv_layers.new(name='UVMap')
        for p in mesh.polygons:
            for li in p.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv=(v.x*1.4+.5, v.z*1.4+.5)
        obj=bpy.data.objects.new(name,mesh); collection.objects.link(obj)
        if metadata: obj['wfc_modules']=json.dumps(metadata)
        return obj

def side_point(face, u, y, depth):
    # Local u increases around the perimeter, so matching faces reverse u.
    return [(u,y,-depth),(depth,y,u),(-u,y,depth),(-depth,y,-u)][face]

objects=[]
foundation=Model()
foundation.box((0,-.19,0),(1,.38,1),6)
foundation.box((0,-.035,0),(1,.07,1),18)
# Individual broad pavers remain legible from the overhead camera.
for row in range(4):
    for col in range(4):
        x=-.5+(col+.5)/4; z=-.5+(row+.5)/4
        foundation.box((x,.005,z),(.243,.012,.243),18 if (col+row)%3 else 19)
for f in range(4):
    for row in range(2):
        for col in range(4):
            u=-.375+col*.25
            foundation.beam(side_point(f,u-.115,-.12-row*.15,.502),side_point(f,u+.115,-.12-row*.15,.502),.012,19)
objects.append(foundation.finish('foundation',[m for m in catalog if m['mesh']=='foundation']))

def face_box(model, face, u, y, depth, width, height, thickness, mat):
    p=side_point(face,u,y,depth)
    model.box(p,(width,height,thickness) if face%2==0 else (thickness,height,width),mat)

def window(model,face,u,y,w,h,shutters=False):
    face_box(model,face,u,y,.493,w,h,.022,16)
    for x in [u-w/2-.018,u+w/2+.018]:
        model.beam(side_point(face,x,y-h/2-.025,.52),side_point(face,x,y+h/2+.025,.52),.033,3)
    for yy in [y-h/2-.025,y+h/2+.025]:
        model.beam(side_point(face,u-w/2-.035,yy,.52),side_point(face,u+w/2+.035,yy,.52),.035,3)
    model.beam(side_point(face,u,y-h/2,.525),side_point(face,u,y+h/2,.525),.018,21)
    model.beam(side_point(face,u-w/2,y,.525),side_point(face,u+w/2,y,.525),.018,21)
    if shutters:
        for x in [u-w/2-.075,u+w/2+.075]:
            face_box(model,face,x,y,.515,.08,h,.035,9)

for mask in range(16):
    for variant in range(3):
        for upper in [False,True]:
            m=Model(); plaster=0 if variant!=1 else 1
            m.box((0,.027,0),(1,.054,1),3)
            m.box((0,.966,0),(1.015,.068,1.015),2)
            for x in [-.475,.475]:
                for z in [-.475,.475]: m.box((x,.5,z),(.055,1,.055),2)
            exposed=[f for f in range(4) if mask&(1<<f)]
            for face in exposed:
                face_box(m,face,0,.5,.468,1,.92,.055,plaster)
                # Lower timber panelling, with fewer broad joints.
                face_box(m,face,0,.085,.505,.94,.12,.035,3)
                for u in [-.32,-.16,0,.16,.32]:
                    m.beam(side_point(face,u,.04,.53),side_point(face,u,.135,.53),.009,2)
                if upper:
                    if variant==1:
                        window(m,face,0,.59,.35,.39,True)
                    else:
                        for u in [-.23,.23]: window(m,face,u,.58,.28,.37)
                    if variant==0:
                        face_box(m,face,0,.29,.58,.86,.06,.22,3)
                        for u in [-.39,-.26,-.13,0,.13,.26,.39]:
                            m.beam(side_point(face,u,.31,.69),side_point(face,u,.51,.69),.022,2)
                        m.beam(side_point(face,-.43,.52,.69),side_point(face,.43,.52,.69),.035,3)
                    elif variant==2:
                        for u in [-.23,.23]:
                            face_box(m,face,u,.34,.56,.32,.095,.13,20)
                            for k in range(3): m.ellipsoid(side_point(face,u-.10+k*.10,.42,.57),(.06,.065,.055),7)
                elif face==exposed[0] or variant==2:
                    # A proper entrance and a display/window bay establish a ground floor.
                    face_box(m,face,-.25,.40,.50,.28,.66,.035,2)
                    for u in [-.35,-.25,-.15]: m.beam(side_point(face,u,.12,.525),side_point(face,u,.69,.525),.018,3)
                    window(m,face,.20,.55,.37,.36,variant==1)
                    face_box(m,face,-.25,.045,.58,.36,.09,.22,19)
                    if variant==2:
                        # An angled timber awning and hanging cloth panels.
                        for u in [-.36,-.18,0,.18,.36]:
                            m.poly([side_point(face,u-.085,.81,.51),side_point(face,u+.085,.81,.51),side_point(face,u+.085,.70,.72),side_point(face,u-.085,.70,.72)],9)
                            face_box(m,face,u,.62,.73,.16,.16,.012,9)
                        m.beam(side_point(face,-.47,.70,.73),side_point(face,.47,.70,.73),.035,3)
                        face_box(m,face,.42,.52,.57,.095,.36,.06,21)
                else:
                    for u in [-.23,.23]: window(m,face,u,.57,.29,.36,variant==1)
                m.beam(side_point(face,-.5,.91,.51),side_point(face,.5,.91,.51),.035,2)
            name=f'room_{mask}_{variant}'+('_upper' if upper else '')
            metadata=None if upper else [d for d in catalog if d['mesh']==name]
            objects.append(m.finish(name,metadata))

corners=[Vector((-.5,.04,-.5)),Vector((.5,.04,-.5)),Vector((.5,.04,.5)),Vector((-.5,.04,.5))]
for mask in range(16):
    m=Model(); center=Vector((0,.52,0))
    for face in range(4):
        a,b=corners[face],corners[(face+1)%4]
        mid=(a+b)/2; mid.y=.52 if mask&(1<<face) else .04
        for left,right in [(a,mid),(mid,b)]:
            m.poly([right,left,center],4)
            # Tile courses follow the authored roof surface, including ridge ports.
            for row in range(1,4):
                t=row/4.8
                p=left.lerp(center,t); q=right.lerp(center,t); p.y+=.016; q.y+=.016
                m.beam(p,q,.018,5)
        if mask&(1<<face):
            p=center.copy(); q=mid.copy(); p.y+=.018; q.y+=.018; m.beam(p,q,.028,5)
        else:
            m.beam(a,b,.045,15)
            outer_a=Vector((a.x*1.10,a.y+.008,a.z*1.10)); outer_b=Vector((b.x*1.10,b.y+.008,b.z*1.10))
            m.poly([outer_b,outer_a,a,b],5)
            m.beam(outer_a,outer_b,.038,5)
            m.poly([(outer_a.x,-.015,outer_a.z),(outer_b.x,-.015,outer_b.z),outer_b,outer_a],15)
            # Close the eave down to the supported room's ceiling plane.
            m.poly([(b.x,0,b.z),(a.x,0,a.z),a,b],2)
    objects.append(m.finish(f'roof_{mask}',[d for d in catalog if d['mesh']==f'roof_{mask}']))

for bridge_kind in ['single','end','span']:
    bridge=Model()
    def deck_y(z):
        return .055+.125*math.sin((z+.5)*math.pi) if bridge_kind=='single' else .055+.125*(z+.5) if bridge_kind=='end' else .18
    for i in range(12):
        z=-.5+i/12; zz=z+1/12; y=deck_y(z); yy=deck_y(zz)
        # Deck sections terminate exactly on the connector plane, with a
        # continuous profile shared by landings and spans.
        bridge.poly([(-.41,y+.02,z),(-.41,yy+.02,zz),(.41,yy+.02,zz),(.41,y+.02,z)],3)
        bridge.poly([(-.41,y-.02,z),(.41,y-.02,z),(.41,yy-.02,zz),(-.41,yy-.02,zz)],3)
        for x in [-.41,.41]:
            side=[(x,y-.02,z),(x,y+.02,z),(x,yy+.02,zz),(x,yy-.02,zz)]
            bridge.poly(side if x>0 else list(reversed(side)),3)
        bridge.beam((-.40,y+.023,z),(.40,y+.023,z),.006,2)
    for i in range(13):
        z=-.5+i/12; y=deck_y(z)
        for x in [-.43,.43]:
            if i%3==0: bridge.box((x,y+.14,z),(.025,.28,.025),2)
    for x in [-.43,.43]:
        for i in range(12):
            z=-.5+i/12; zz=z+1/12
            bridge.beam((x,deck_y(z)+.24,z),(x,deck_y(zz)+.24,zz),.025,2)
    for z in ([-.5,.5] if bridge_kind=='single' else [-.5] if bridge_kind=='end' else []):
        cap=[(-.41,0,z),(-.41,deck_y(z)+.02,z),(.41,deck_y(z)+.02,z),(.41,0,z)]
        bridge.poly(cap if z<0 else list(reversed(cap)),3)
    objects.append(bridge.finish(f'bridge_{bridge_kind}',[d for d in catalog if d['mesh']==f'bridge_{bridge_kind}']))

lantern=Model()
lantern.ellipsoid((0,.17,0),(.09,.13,.09),8,12,8)
for y in [.06,.10,.23,.28]: lantern.box((0,y,0),(.17,.012,.17),3)
lantern.box((0,.30,0),(.21,.025,.21),4); lantern.beam((0,.31,0),(0,.37,0),.018,2)
objects.append(lantern.finish('lantern'))
planter=Model(); planter.box((0,.07,0),(.36,.14,.28),20)
planter.box((0,.145,0),(.39,.025,.31),19)
for i,(x,z) in enumerate([(-.12,0),(.10,.04),(0,-.07)]):
    planter.ellipsoid((x,.21,z),(.11,.10,.10),7)
    planter.ellipsoid((x,.29,z),(.055,.04,.055),10 if i%2 else 11)
objects.append(planter.finish('planter'))
for name,flowering in [('willow',False),('sakura',True)]:
    tree=Model(); tree.beam((0,0,0),(.04,.72,0),.09,2)
    for i,(x,y,z,size) in enumerate([(-.24,.85,0,.33),(.24,.93,.1,.38),(0,1.16,-.15,.34),(-.10,1.23,.18,.28)]):
        tree.beam((.025,.48,0),(x,y,z),.04,3)
        tree.ellipsoid((x,y,z),(size,size*.78,size),10 if flowering else [7,12,7,13][i],10,7)
    objects.append(tree.finish(name))
crates=Model(); crates.box((0,.12,0),(.30,.24,.28),3)
for x in [-.12,.12]: crates.box((x,.13,.145),(.022,.23,.018),2)
crates.beam((-.14,.025,.16),(.14,.23,.16),.024,2)
objects.append(crates.finish('crates'))
boat=Model()
boat.poly([(-.20,.015,-.50),(.20,.015,-.50),(.28,.015,.28),(0,.015,.62),(-.28,.015,.28)],9)
for a,b in [((-.20,.02,-.50),(-.28,.02,.28)),((-.28,.02,.28),(0,.02,.62)),((0,.02,.62),(.28,.02,.28)),((.28,.02,.28),(.20,.02,-.50)),((.20,.02,-.50),(-.20,.02,-.50))]:
    boat.beam(a,b,.065,3)
    boat.poly([a,b,(b[0]*.7,-.17,b[2]*.9),(a[0]*.7,-.17,a[2]*.9)],9)
for z in [-.29,0,.26]: boat.box((0,.05,z),(.40,.035,.09),3)
boat.beam((-.4,.10,-.30),(.23,.13,.39),.025,3)
objects.append(boat.finish('boat'))
curtain=Model(); curtain.box((0,.08,0),(.4,.16,.008),9); objects.append(curtain.finish('noren'))

bank=Model()
bank.box((0,.035,-.46),(1,.09,.105),19)
for u in [-.375,-.125,.125,.375]:
    bank.box((u,-.105,-.505),(.244,.15,.03),6)
    bank.box((u,-.27,-.505),(.244,.15,.03),19)
objects.append(bank.finish('bank_edge'))
rail=Model()
for u in [-.46,0,.46]: rail.box((u,.22,-.46),(.035,.39,.035),14)
for y in [.12,.35]: rail.beam((-.49,y,-.46),(.49,y,-.46),.025,14)
for u in [-.30,-.15,.15,.30]: rail.beam((u,.13,-.46),(u,.34,-.46),.014,14)
objects.append(rail.finish('railing'))
bench=Model()
for x in [-.24,.24]:
    bench.box((x,.12,0),(.055,.24,.25),14)
    bench.beam((x,.22,-.10),(x,.45,-.13),.035,14)
for z in [-.09,0,.09]: bench.box((0,.245,z),(.62,.045,.075),3)
for y in [.34,.43]: bench.box((0,y,-.14),(.62,.055,.035),3)
objects.append(bench.finish('bench'))
umbrella=Model(); umbrella.beam((0,0,0),(0,.94,0),.025,3)
for i in range(10):
    a=i*math.tau/10; b=(i+1)*math.tau/10
    umbrella.poly([(0,1.04,0),(.43*math.cos(a),.83,.43*math.sin(a)),(.43*math.cos(b),.83,.43*math.sin(b))],20 if i%2 else 21)
umbrella.box((0,.45,0),(.52,.045,.44),3)
objects.append(umbrella.finish('market_umbrella'))
reeds=Model()
for i in range(7):
    a=i*2.4; x=math.sin(a)*.13; z=math.cos(a)*.13
    reeds.beam((x,0,z),(x*1.3,.22+(i%3)*.09,z*1.3),.014,13)
    reeds.ellipsoid((x*1.3,.24+(i%3)*.09,z*1.3),(.018,.05,.018),11,5,4)
objects.append(reeds.finish('reeds'))
# Separate source pieces make contextual assembly inspectable in Blender.
for name, source in [('bank_straight','bank_edge'),('bank_corner','bank_edge'),('stone_lane','foundation'),('engawa','room_15_0_upper'),('roof_ridge_end','roof_1'),('roof_valley','roof_3')]:
    source_obj=next(o for o in objects if o.name==source)
    obj=bpy.data.objects.new(name,source_obj.data); collection.objects.link(obj); objects.append(obj)

# Bake plaster noise to an exportable image. The source material remains editable.
swatch=Model(); swatch.poly([(-.5,0,-.5),(.5,0,-.5),(.5,0,.5),(-.5,0,.5)],0); swatch_obj=swatch.finish('Bake swatch')
nodes=mats[0].node_tree.nodes; links=mats[0].node_tree.links
noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=85
ramp=nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(.87,.87,.87,1); ramp.color_ramp.elements[1].color=(.98,.98,.98,1)
links.new(noise.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
image=bpy.data.images.new('Baked plaster',width=256,height=256)
target=nodes.new('ShaderNodeTexImage'); target.image=image; nodes.active=target
bpy.ops.object.select_all(action='DESELECT'); swatch_obj.select_set(True); bpy.context.view_layer.objects.active=swatch_obj
bpy.context.scene.render.engine='CYCLES'; bpy.context.scene.cycles.samples=1
bpy.context.scene.render.bake.use_pass_direct=False; bpy.context.scene.render.bake.use_pass_indirect=False; bpy.context.scene.render.bake.use_pass_color=True
bpy.ops.object.bake(type='DIFFUSE')
image.filepath_raw=str(OUT/'plaster.png'); image.file_format='PNG'; image.save(); image.pack()
links.new(target.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])

for obj in bpy.context.selected_objects: obj.select_set(False)
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'canal-kit.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True)
exported=[]
for obj in objects:
    if 'wfc_modules' in obj: exported.extend(json.loads(obj['wfc_modules']))
exported.sort(key=lambda d: next(i for i,m in enumerate(catalog) if m['id']==d['id']))
# Air has no mesh; it remains a real solver module.
exported=[catalog[0]]+exported
manifest={'version':'canal-1','modules':exported,'families':sorted(set(m['family'] for m in catalog)), 'props':['lantern','planter','willow','crates','boat','noren','sakura','bench','market_umbrella','reeds'], 'details':['bank_edge','railing'], 'visualRevision':2,'coordinates':'Canonical Y-up; x/z [-.5,.5]; faces z-, x+, z+, x-, below, above','source':'Original Blender-authored Canal Town kit'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
# A separate scene presents linked copies of the canonical source meshes.
# Export transforms remain pristine in the library scene.
gallery=bpy.data.scenes.new('Canal Kit Gallery')
gallery_collection=bpy.data.collections.new('Canal Kit Gallery'); gallery.collection.children.link(gallery_collection)
bpy.context.window.scene=gallery
examples={}
for m in catalog:
    if m['category']!='air': examples.setdefault(m['family'],m['mesh'])
examples.update({name:name for name in manifest['props']+manifest['details']})
examples.update({'upper balcony':'room_15_0_upper','upper shutters':'room_15_1_upper','upper flower boxes':'room_15_2_upper'})
for i,(label,mesh_name) in enumerate(examples.items()):
    source=next(o for o in objects if o.name==mesh_name)
    obj=bpy.data.objects.new('Preview '+label,source.data); gallery_collection.objects.link(obj)
    x=(i%6-2.5)*2.15; y=(2.5-i//6)*2.1
    obj.location=(x,y,0)
    if mesh_name in manifest['props']: obj.scale=(1.6,1.6,1.6)
    text=bpy.data.curves.new('Label '+label,'FONT'); text.body=label; text.size=.12; text.align_x='CENTER'
    caption=bpy.data.objects.new(text.name,text); gallery_collection.objects.link(caption); caption.location=(x,y-.82,.01); text.materials.append(mats[2])
floor_mesh=bpy.data.meshes.new('Gallery floor'); floor_mesh.from_pydata([(-9,-12,-.42),(9,-12,-.42),(9,9,-.42),(-9,9,-.42)],[],[(0,1,2,3)])
floor=bpy.data.objects.new('Gallery floor',floor_mesh); gallery_collection.objects.link(floor); floor_mesh.materials.append(material('Gallery ivory',(.70,.74,.68)))
camera_data=bpy.data.cameras.new('Gallery camera'); camera=bpy.data.objects.new('Gallery camera',camera_data); gallery_collection.objects.link(camera)
camera.location=(8,-13,20); camera.rotation_euler=(Vector((0,-2,0))-camera.location).to_track_quat('-Z','Y').to_euler(); camera_data.type='ORTHO'; camera_data.ortho_scale=23; gallery.camera=camera
for name,position,energy,size in [('Key',(-5,-2,12),1900,9),('Fill',(6,6,9),1100,7)]:
    data=bpy.data.lights.new('Gallery '+name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    light=bpy.data.objects.new(data.name,data); gallery_collection.objects.link(light); light.location=position; light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
gallery.world=bpy.data.worlds.new('Gallery world'); gallery.world.use_nodes=True; gallery.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.4,.36,1); gallery.world.node_tree.nodes['Background'].inputs[1].default_value=.6
gallery.render.engine='CYCLES'; gallery.cycles.samples=16; gallery.cycles.use_denoising=True
gallery.render.resolution_x=1800; gallery.render.resolution_y=1900; gallery.render.resolution_percentage=100
gallery.render.image_settings.file_format='PNG'; gallery.render.filepath=str(SOURCE/'kit-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'canal-kit.blend'))

if not globals().get('SKIP_GALLERY_RENDER',False): bpy.ops.render.render(write_still=True)
result={'objects':len(objects),'solver_modules':len(exported),'triangles':sum(len(o.data.polygons)*2 for o in objects),'glb_bytes':(OUT/'canal-kit.glb').stat().st_size,'blend':str(SOURCE/'canal-kit.blend')}
