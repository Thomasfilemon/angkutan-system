const { DepositGroup, DepositGroupMember, DeliveryOrder, DeliveryOrderPayments, DeliveryOrderAdjustments } = require("../../models");
const { Op, fn, col } = require("sequelize");

// Helper function to get paid amount for a DO
async function getTotalPaidAmount(doId) {
  try {
    const result = await DeliveryOrderPayments.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('payment_amount')), 0), 'total_paid']],
      where: { delivery_order_id: doId },
      raw: true,
    });
    return parseFloat(result?.total_paid || 0);
  } catch (err) {
    console.error('Error calculating paid amount:', err);
    return 0;
  }
}

module.exports = {
  // Add this new method to the depositGroup controller
  // Update the finalizeDOAmount method
  // Add this new method
  // Example controller logic
  async finalizeDOAmount(req, res) {
    const { do_id } = req.params; // ✅ Use the correct parameter name
    const { finalized_amount } = req.body;

    try {
      const deliveryOrder = await DeliveryOrder.findByPk(do_id); // Now uses the correct ID
      if (!deliveryOrder) {
        return res.status(404).json({ error: 'Delivery Order not found' });
      }

      await deliveryOrder.update({
        final_amount: finalized_amount,
        is_amount_finalized: true
      });

      res.json({ success: true, message: 'Amount finalized successfully', deliveryOrder });
    } catch (error) {
      console.error('Error finalizing DO amount:', error);
      res.status(500).json({ error: 'Failed to finalize amount' });
    }
  },
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
          include: [
            {
              model: DeliveryOrder,
              as: 'deliveryOrder', // ✅ Must match the alias defined in the association
              attributes: ['id', 'do_number', 'customer_name', 'final_amount', 'total_amount', 'is_amount_finalized', 'payment_status']
            }
          ]
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
  // In depositGroup.controller.js
  // depositGroup.controller.js
  async getGroupDetails(req, res) {
    const { id } = req.params;
    try {
      const group = await DepositGroup.findByPk(id, {
        include: [
          {
            model: DepositGroupMember,
            as: "members", // ✅ Matches the alias defined in DepositGroup
            include: [
              {
                model: DeliveryOrder,
                as: "deliveryOrder", // ✅ Matches the alias defined in DepositGroupMember
                attributes: [
                  "id",
                  "do_number",
                  "customer_name",
                  "final_amount",
                  "total_amount",
                  "is_amount_finalized",
                  "payment_status"
                ]
              }
            ],
            attributes: ["id", "delivery_order_id", "quantity"]
          }
        ]
      });

      res.json(group);
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

  async updateMemberQuantity(req, res) {
    const { doId } = req.params;
    const { quantity } = req.body;

    try {
      const member = await DepositGroupMember.findOne({
        where: { delivery_order_id: doId }
      });

      if (!member) {
        return res.status(404).json({ error: "Group member not found" });
      }

      await member.update({ quantity });
      res.json({ success: true, member });
    } catch (error) {
      res.status(500).json({ error: "Failed to update quantity" });
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
  },

  // Adjust DO price
  async adjustDOPrice(req, res) {
    try {
      const { do_id } = req.params;
      const { new_amount, reason } = req.body;
      const userId = req.user?.id; // Assuming user ID from auth middleware

      const deliveryOrder = await DeliveryOrder.findByPk(do_id);
      if (!deliveryOrder) {
        return res.status(404).json({ error: "Delivery Order not found" });
      }

      const originalAmount = parseFloat(deliveryOrder.final_amount) || parseFloat(deliveryOrder.total_amount) || 0;
      const adjustmentAmount = parseFloat(new_amount) - originalAmount;
      const finalAmount = parseFloat(new_amount);

      if (isNaN(finalAmount) || finalAmount < 0) {
        return res.status(400).json({ error: "Invalid new amount - must be a non-negative number" });
      }

      // Create or update adjustment record
      const existingAdjustment = await DeliveryOrderAdjustments.findOne({
        where: { delivery_order_id: do_id },
      });

      let adjustment;
      if (existingAdjustment) {
        await existingAdjustment.update({
          adjustment_type: 'price_override',
          original_amount,
          adjustment_amount: adjustmentAmount,
          final_amount: finalAmount,
          reason: reason || 'Price finalization',
          approved_by: userId,
          updated_by: userId,
          updated_at: new Date(),
        });
        adjustment = existingAdjustment;
      } else {
        adjustment = await DeliveryOrderAdjustments.create({
          delivery_order_id: do_id,
          adjustment_type: 'price_override',
          original_amount,
          adjustment_amount: adjustmentAmount,
          final_amount: finalAmount,
          reason: reason || 'Price finalization',
          approved_by: userId,
          created_by: userId,
        });
      }

      // Update Delivery Order
      await deliveryOrder.update({
        final_amount: finalAmount,
        price_adjustment_reason: reason || null,
      });

      res.json({
        success: true,
        message: "DO price adjusted successfully - amounts recalculated",
        data: {
          adjustment,
          do_id: deliveryOrder.id,
          old_amount: originalAmount,
          new_amount: finalAmount,
          reason: reason || 'Price finalization',
        },
      });
    } catch (error) {
      console.error("Error adjusting DO price:", error);
      res.status(500).json({ error: "Failed to adjust DO price" });
    }
  },
};