import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Phone, Mail, MapPin, User } from "lucide-react";

interface Authority {
  id: string;
  name: string;
  designation: string;
  department: string;
  location: string;
  phone: string;
  email: string;
  status: 'Available' | 'Busy' | 'Offline';
  specialization: string[];
}

export function AuthoritiesPage() {
  const authorities: Authority[] = [
    {
      id: '1',
      name: 'Dr. Rajesh Kumar',
      designation: 'District Collector',
      department: 'Administration',
      location: 'Ranchi',
      phone: '+91 98765 43210',
      email: 'collector.ranchi@gov.in',
      status: 'Available',
      specialization: ['General Administration', 'Emergency Response', 'Public Welfare']
    },
    {
      id: '2',
      name: 'Priya Sharma',
      designation: 'Chief Medical Officer',
      department: 'Health',
      location: 'Jamshedpur',
      phone: '+91 98765 43211',
      email: 'cmo.jamshedpur@health.gov.in',
      status: 'Busy',
      specialization: ['Healthcare Management', 'Medical Emergency', 'Public Health']
    },
    {
      id: '3',
      name: 'Amit Singh',
      designation: 'Municipal Commissioner',
      department: 'Urban Development',
      location: 'Dhanbad',
      phone: '+91 98765 43212',
      email: 'commissioner.dhanbad@urban.gov.in',
      status: 'Available',
      specialization: ['Infrastructure', 'Water Supply', 'Waste Management']
    },
    {
      id: '4',
      name: 'Sunita Devi',
      designation: 'Education Officer',
      department: 'Education',
      location: 'Bokaro',
      phone: '+91 98765 43213',
      email: 'education.bokaro@edu.gov.in',
      status: 'Available',
      specialization: ['School Management', 'Teacher Training', 'Student Welfare']
    },
    {
      id: '5',
      name: 'Vikash Gupta',
      designation: 'Transport Commissioner',
      department: 'Transport',
      location: 'Ranchi',
      phone: '+91 98765 43214',
      email: 'transport.ranchi@gov.in',
      status: 'Offline',
      specialization: ['Public Transport', 'Traffic Management', 'Road Safety']
    },
    {
      id: '6',
      name: 'Anita Kumari',
      designation: 'Environmental Officer',
      department: 'Environment',
      location: 'Jamshedpur',
      phone: '+91 98765 43215',
      email: 'environment.jamshedpur@gov.in',
      status: 'Available',
      specialization: ['Pollution Control', 'Environmental Compliance', 'Green Initiatives']
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800 border-green-200';
      case 'Busy': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Offline': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDepartmentColor = (department: string) => {
    const colors = {
      'Administration': 'bg-blue-100 text-blue-800',
      'Health': 'bg-red-100 text-red-800',
      'Urban Development': 'bg-purple-100 text-purple-800',
      'Education': 'bg-green-100 text-green-800',
      'Transport': 'bg-orange-100 text-orange-800',
      'Environment': 'bg-teal-100 text-teal-800'
    };
    return colors[department as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Government Authorities</h1>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          Add New Authority
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-white rounded-xl border shadow-sm">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Total Authorities</div>
            <div className="text-2xl font-semibold text-gray-900">{authorities.length}</div>
            <div className="text-sm text-green-600">+2 this month</div>
          </div>
        </Card>
        <Card className="p-6 bg-white rounded-xl border shadow-sm">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Currently Available</div>
            <div className="text-2xl font-semibold text-gray-900">
              {authorities.filter(a => a.status === 'Available').length}
            </div>
            <div className="text-sm text-green-600">Online now</div>
          </div>
        </Card>
        <Card className="p-6 bg-white rounded-xl border shadow-sm">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Departments</div>
            <div className="text-2xl font-semibold text-gray-900">
              {new Set(authorities.map(a => a.department)).size}
            </div>
            <div className="text-sm text-blue-600">Active departments</div>
          </div>
        </Card>
      </div>

      {/* Authorities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {authorities.map((authority) => (
          <Card key={authority.id} className="p-6 bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{authority.name}</h3>
                    <p className="text-sm text-gray-600">{authority.designation}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(authority.status)}>
                  {authority.status}
                </Badge>
              </div>

              {/* Department */}
              <Badge className={getDepartmentColor(authority.department)}>
                {authority.department}
              </Badge>

              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{authority.location}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{authority.phone}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{authority.email}</span>
                </div>
              </div>

              {/* Specializations */}
              <div>
                <div className="text-xs text-gray-500 mb-2">Specializations</div>
                <div className="flex flex-wrap gap-1">
                  {authority.specialization.map((spec, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={authority.status === 'Offline'}
                >
                  Contact
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  View Profile
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}