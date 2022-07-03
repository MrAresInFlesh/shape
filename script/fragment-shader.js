#ifdef GL_ES
precision highp float;
precision highp int;
#endif

const float EPSILON = 0.00001;
const float RADIUS = 1.0;
uniform float zoom;

varying vec4 vPosition;
varying vec4 vColor;

uniform vec3 lightPos;
vec3 camera = vec3(0.0, 0.0, 10.0);

uniform sampler2D pointsTex;
uniform int pointsSize;

vec3 getFromTex(int i)
{
    return texture2D(pointsTex, vec2(float(i) / float(pointsSize))).xyz;
}

float distSquared(vec3 p1, vec3 p2)
{
    return (p1.x - p2.x) * (p1.x - p2.x)
            + (p1.y - p2.y) * (p1.y - p2.y)
            + (p1.z - p2.z) * (p1.z - p2.z);
}

vec3 pointOnPlan(vec3 f, vec3 n)
{
    vec3 c = camera - f;
    n = normalize(n) * RADIUS / 2.0;

    float d = n.x * n.x + n.y * n.y + n.z * n.z;
    float k = (d - n.x * f.x - n.y * f.y - n.z * f.z) / (n.x * c.x + n.y * c.y + n.z * c.z);
    
    return k * c + f;
}

float pointInPlan(vec3 p, vec3 n)
{
    n = normalize(n) * RADIUS / 2.0;
    float d = n.x * n.x + n.y * n.y + n.z * n.z;
    return n.x * p.x + n.y * p.y + n.z * p.z - d;
}

int nearestNorm(vec3 f)
{
    int nearest;
    float distNear = 10.0 * RADIUS;

    for (int i = 0; i >= 0; ++i)
    {
        if (i > pointsSize)
        {
            return nearest;
        }

        vec3 n = getFromTex(i);
        vec3 I = pointOnPlan(f, n);
        float dist = distSquared(I, vec3(0.0, 0.0, -RADIUS));

        if (dist < distNear && dot(camera - I, n) > EPSILON)
        {
            nearest = i;
            distNear = dist;
        }
    }

    return nearest;
}

bool isBackground(vec3 f, int planIndex)
{
    vec3 I = pointOnPlan(f, getFromTex(planIndex));
    
    for (int i = 0; i >= 0; ++i)
    {
        if (i > pointsSize)
        {
            return false;
        }

        vec3 n = getFromTex(i);

        if (pointInPlan(I, n) > EPSILON)
        {
            return true;
        }
    }

    return false;
}

void main(void)
{
    float shininess = 5.0;
    float ka = 1.0;
    float kd = 1.0;
    float ks = 1.0;

    float dist = sqrt(vPosition.x * vPosition.x + vPosition.y * vPosition.y);
    vec4 finalColor = vec4(1.0, 1.0, 1.0, 1.0);

    vec3 f = vec3(vPosition.x * zoom, vPosition.y * zoom, 0.0);
    int planIndex = nearestNorm(f);

    if (!isBackground(f, planIndex))
    {
        vec3 P = pointOnPlan(f, getFromTex(planIndex));
        vec3 N = normalize(getFromTex(planIndex));

        vec3 L = normalize(lightPos - P);
        vec3 R = reflect(-L, N);
        vec3 V = normalize(camera - P);

        float diffuse = max(dot(L, N), 0.0);

        float angle = max(dot(R, V), 0.0);
        float specular = pow(angle, shininess);

        vec3 ambientColor = vec3(0.1, 0.1, 0.3);
        vec3 diffuseColor = vColor.xyz;
        vec3 specularColor = vColor.xyz;
        
        finalColor = vec4(ka * ambientColor 
                + kd * diffuse * diffuseColor
                + ks * specular * specularColor, 1.0);
    }

       gl_FragColor = finalColor;
}