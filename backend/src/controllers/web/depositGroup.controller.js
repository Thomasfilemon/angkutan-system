const { DepositGroup, DepositGroupMember, DeliveryOrder, DeliveryOrderPayments } = require("../../models");
const { Op, fn, col } = require("sequelize");

// Helper function to get paid amount for a DO
async function getTotalPaidAmount(doId) {
  const result = await DeliveryOrderPayments.findOne({
    attributes: [
      [fn('COALESCE', fn('SUM', col('payment_amount')), 0), 'total_paid']
    ],
    where: { delivery_order_id: doId },
    raw: true
  });
  
  return parseFloat(result?.total_paid || 0);
}

module.exports = {
  // Create new deposit group
  async createGroup(req, res) {
    try {
      const { group_name, balance = 0, delivery_order_ids = [] } = req.body;
      
      const group = await DepositGroup.create({ 
        group_name, 
        balance: parseFloat(balance) 
      });
      
      // Add DOs to group if provided
      if (delivery_order_ids.length > 0) {
        const members = delivery_order_ids.map(do_id => ({
          group_id: group.id,
          delivery_order_id: do_id
        }));
        
        await DepositGroupMember.bulkCreate(members);
      }
      
      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating deposit group:", error);
      res.status(500).json({ error: "Failed to create deposit group" });
    }
  },

  // Get all groups with calculated status
  async getAllGroups(req, res) {
    try {
      const groups = await DepositGroup.findAll({
        include: [{
          model: DepositGroupMember,
          as: 'members',
          attributes: [],
        }]
      });
      
      // Calculate status for each group
      const groupsWithStatus = await Promise.all(groups.map(async group => {
        // Get all DOs in this group
        const members = await DepositGroupMember.findAll({
          where: { group_id: group.id },
          include: [{
            model: DeliveryOrder,
            as: 'deliveryOrder',
            attributes: ['id', 'final_amount']
          }]
        });
        
        // Calculate total unpaid
        let totalUnpaid = 0;
        for (const member of members) {
          const paid = await getTotalPaidAmount(member.deliveryOrder.id);
          const unpaid = member.deliveryOrder.final_amount - paid;
          if (unpaid > 0) totalUnpaid += unpaid;
        }
        
        // Determine status
        let status = 'normal';
        if (totalUnpaid > group.balance) {
          status = 'butuh bayar';
        } else if (group.balance > totalUnpaid) {
          status = 'extra saldo';
        }
        
        return {
          ...group.get({ plain: true }),
          status
        };
      }));
      
      res.json(groupsWithStatus);
    } catch (error) {
      console.error("Error fetching deposit groups:", error);
      res.status(500).json({ error: "Failed to fetch deposit groups" });
    }
  },

  // Get group details with DO information
  async getGroupDetails(req, res) {
    try {
      const { id } = req.params;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Get members with DO details
      const members = await DepositGroupMember.findAll({
        where: { group_id: id },
        include: [{
          model: DeliveryOrder,
          as: 'deliveryOrder',
          attributes: ['id', 'do_number', 'customer_name', 'final_amount', 'payment_status']
        }]
      });
      
      // Add paid/unpaid amounts to each DO
      const membersWithPayments = await Promise.all(
        members.map(async member => {
          const doData = member.deliveryOrder;
          const paidAmount = await getTotalPaidAmount(doData.id);
          
          return {
            ...member.get({ plain: true }),
            deliveryOrder: {
              ...doData.get({ plain: true }),
              paid_amount: paidAmount,
              unpaid_amount: doData.final_amount - paidAmount
            }
          };
        })
      );
      
      // Calculate group status
      const totalUnpaid = membersWithPayments.reduce((sum, member) => {
        return sum + member.deliveryOrder.unpaid_amount;
      }, 0);
      
      let status = 'normal';
      if (totalUnpaid > group.balance) {
        status = 'butuh bayar';
      } else if (group.balance > totalUnpaid) {
        status = 'extra saldo';
      }
      
      res.json({
        ...group.get({ plain: true }),
        members: membersWithPayments,
        status
      });
    } catch (error) {
      console.error("Error fetching group details:", error);
      res.status(500).json({ error: "Failed to fetch group details" });
    }
  },

  // Update group details
  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const { group_name, balance } = req.body;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      if (group_name) group.group_name = group_name;
      if (balance !== undefined) group.balance = parseFloat(balance);
      
      await group.save();
      res.json(group);
    } catch (error) {
      console.error("Error updating group:", error);
      res.status(500).json({ error: "Failed to update group" });
    }
  },

  // Add DO to group
  async addDOToGroup(req, res) {
    try {
      const { group_id, delivery_order_id } = req.body;
      
      // Check if DO already belongs to a group
      const existingMembership = await DepositGroupMember.findOne({
        where: { delivery_order_id }
      });
      
      if (existingMembership) {
        return res.status(400).json({ 
          error: "DO already belongs to another group" 
        });
      }
      
      const membership = await DepositGroupMember.create({
        group_id,
        delivery_order_id
      });
      
      res.status(201).json(membership);
    } catch (error) {
      console.error("Error adding DO to group:", error);
      res.status(500).json({ error: "Failed to add DO to group" });
    }
  },

  // Remove DO from group
  async removeDOFromGroup(req, res) {
    try {
      const { id } = req.params; // membership ID
      
      const membership = await DepositGroupMember.findByPk(id);
      if (!membership) {
        return res.status(404).json({ error: "Membership not found" });
      }
      
      await membership.destroy();
      res.status(204).end();
    } catch (error) {
      console.error("Error removing DO from group:", error);
      res.status(500).json({ error: "Failed to remove DO from group" });
    }
  },

  // Delete entire group
  async deleteGroup(req, res) {
    try {
      const { id } = req.params;
      
      const group = await DepositGroup.findByPk(id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      // Delete all memberships first
      await DepositGroupMember.destroy({ where: { group_id: id } });
      
      await group.destroy();
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  }
};